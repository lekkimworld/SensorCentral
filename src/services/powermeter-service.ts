import constants from "../constants";
import {
    BackendIdentity,
    BaseService,
    IngestedDeviceMessage,
    IngestedSensorMessage,
    InitCallback,
} from "../types";
import { SmartmeDeviceWithDataType, PowerUnit, Cloudflare524Error } from "../resolvers/smartme";
import { Logger } from "../logger";
import { PubsubService, TopicMessage } from "./pubsub-service";
import { StorageService } from "./storage-service";
import { IdentityService } from "./identity-service";
import { CronService } from "./cron-service";
import { objectHasOwnProperty_Trueish } from "../utils";
import { QueueService } from "./queue-service";
import CalloutService, { MIMETYPE_JSON } from "./callout-service";

const logger = new Logger("powermeter-service");

export class PowermeterService extends BaseService {
    public static NAME = "powermeter";
    pubsub!: PubsubService;
    queues!: QueueService;
    storageService!: StorageService;
    security!: IdentityService;
    cron!: CronService;
    calloutService!: CalloutService;
    authUser!: BackendIdentity;

    constructor() {
        super(PowermeterService.NAME);
        this.dependencies = [
            PubsubService.NAME,
            StorageService.NAME,
            IdentityService.NAME,
            CronService.NAME,
            QueueService.NAME,
            CalloutService.NAME,
        ];
    }

    async init(callback: InitCallback, services: BaseService[]) {
        this.pubsub = services[0] as PubsubService;
        this.storageService = services[1] as StorageService;
        this.security = services[2] as IdentityService;
        this.cron = services[3] as CronService;
        this.queues = services[4] as QueueService;
        this.calloutService = services[5] as CalloutService;

        // get auth user for service
        this.authUser = await this.security.getServiceBackendIdentity(PowermeterService.NAME);

        // listen for cron job events
        this.pubsub.subscribe(
            `${constants.TOPICS.CONTROL}.cronjob.create`,
            this.listenForCronJobCreate.bind(this)
        );
        this.pubsub.subscribe(
            `${constants.TOPICS.CONTROL}.cronjob.update`,
            this.listenForCronJobUpdate.bind(this)
        );
        this.pubsub.subscribe(
            `${constants.TOPICS.CONTROL}.cronjob.delete`,
            this.listenForCronJobDelete.bind(this)
        );

        // load cron jobs
        const cronJobs = await this.storageService!.getAllCronJobs(this.authUser);
        logger.info(`Loading ${cronJobs.length} cron job(s) from database`);
        cronJobs.forEach((job) => {
            if (job.active && job.calloutId && job.sensorId && job.houseId) {
                this.addCronJobFromConfig(job.id, job.userId, job.houseId, job.sensorId, job.frequencyMinutes, job.calloutId);
            } else if (!job.active) {
                logger.info(`Skipping inactive cron job <${job.id}> for user <${job.userId}>`);
            }
        });

        // callback
        callback();
    }

    private logAndGetMessage(result: TopicMessage): any {
        logger.debug(
            `Received message on channel ${result.channel} with payload=${JSON.stringify(result.data)}`
        );
        const msg = result.data as any;
        return msg;
    }

    private getCronJobName(jobId: string): string {
        return `cronjob_${jobId}`;
    }

    private addCronJobFromConfig(jobId: string, userId: string, houseId: string, sensorId: string, frequencyMinutes: number, calloutId: string) {
        const jobName = this.getCronJobName(jobId);
        this.cron.add(jobName, `*/${frequencyMinutes} * * * *`, async () => {
            if (objectHasOwnProperty_Trueish(process.env, "CRON_POWERMETER_SUBSCRIPTIONS_DISABLED")) {
                logger.warn(`Ignoring cron job due to CRON_POWERMETER_SUBSCRIPTIONS_DISABLED (${jobName})`);
                return;
            }
            try {
                const deviceData = await this.calloutService.calloutById<any>(this.authUser, calloutId, { sensorId }, { accept: "application/json" });
                if (!deviceData) {
                    logger.warn(`Cron job <${jobId}>: no device data returned for sensor <${sensorId}>`);
                    return;
                }

                const parsed = new SmartmeDeviceWithDataType(deviceData);
                const sensor = await this.storageService.getSensor(this.authUser, sensorId);
                const deviceId = sensor.deviceId;

                const payload: IngestedDeviceMessage = { id: deviceId };

                if (parsed.counterReadingUnit === PowerUnit.kWh) {
                    parsed.counterReading = parsed.counterReading * 1000;
                    parsed.counterReadingImport = parsed.counterReadingImport * 1000;
                }

                this.queues.publish(constants.QUEUES.DEVICE, payload).then(() => {
                    this.queues.publish(constants.QUEUES.SENSOR, {
                        deviceId,
                        id: parsed.id,
                        dt: parsed.valueDate.toISOString(),
                        value: parsed.counterReadingImport,
                    } as IngestedSensorMessage);
                });

                this.storageService.persistPowermeterReadingFromDeviceRequest(parsed);
            } catch (err: any) {
                if (err instanceof Cloudflare524Error) {
                    logger.warn(`Cron job <${jobId}>: Cloudflare 524 (${err.message})`);
                } else {
                    logger.warn(`Cron job <${jobId}>: unexpected error (${err.message})`);
                }
            }
        }, false, { type: "cronjob", jobId, userId, houseId, sensorId });
    }

    private async listenForCronJobCreate(result: TopicMessage) {
        const msg = this.logAndGetMessage(result);
        const job = msg.new;
        const userId = job.userId || msg.user?.identity?.callerId || "unknown";
        logger.info(`Cron job created <${job.id}> for user <${userId}> — scheduling`);
        if (job.calloutId && job.sensorId && job.houseId) {
            this.addCronJobFromConfig(job.id, userId, job.houseId, job.sensorId, job.frequencyMinutes, job.calloutId);
        }
    }

    private async listenForCronJobUpdate(result: TopicMessage) {
        const msg = this.logAndGetMessage(result);
        const job = msg.new;
        const userId = job.userId || msg.user?.identity?.callerId || "unknown";
        this.cron.remove(this.getCronJobName(job.id));
        if (job.active && job.calloutId && job.sensorId && job.houseId) {
            logger.info(`Cron job updated <${job.id}> for user <${userId}> — rescheduling every ${job.frequencyMinutes} min`);
            this.addCronJobFromConfig(job.id, userId, job.houseId, job.sensorId, job.frequencyMinutes, job.calloutId);
        } else {
            logger.info(`Cron job updated <${job.id}> for user <${userId}> — now inactive, unscheduled`);
        }
    }

    private async listenForCronJobDelete(result: TopicMessage) {
        const msg = this.logAndGetMessage(result);
        const userId = msg.user?.identity?.callerId || "unknown";
        logger.info(`Cron job deleted <${msg.old.id}> for user <${userId}> — unscheduling`);
        this.cron.remove(this.getCronJobName(msg.old.id));
    }
}
