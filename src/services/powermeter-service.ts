import constants from "../constants";
import {
    BackendIdentity,
    BaseService,
    CronJob,
    CronJobType,
    IngestedDeviceMessage,
    IngestedSensorMessage,
    InitCallback,
} from "../types";
import { SmartmeDeviceWithDataType, PowerUnit, Cloudflare524Error } from "../resolvers/smartme";
import { Logger } from "../logger";
import { StorageService } from "./storage-service";
import { IdentityService } from "./identity-service";
import { CronService } from "./cron-service";
import { objectHasOwnProperty_Trueish } from "../utils";
import { QueueService } from "./queue-service";
import CalloutService from "./callout-service";
import { CronJobHandler } from "./cronjob-scheduler-service";

const logger = new Logger("powermeter-service");

export class PowermeterService extends BaseService implements CronJobHandler {
    public static NAME = "powermeter";
    private storageService!: StorageService;
    private security!: IdentityService;
    private queues!: QueueService;
    private calloutService!: CalloutService;
    private authUser!: BackendIdentity;

    constructor() {
        super(PowermeterService.NAME);
        this.dependencies = [
            StorageService.NAME,
            IdentityService.NAME,
            QueueService.NAME,
            CalloutService.NAME,
        ];
    }

    async init(callback: InitCallback, services: BaseService[]) {
        this.storageService = services[0] as StorageService;
        this.security = services[1] as IdentityService;
        this.queues = services[2] as QueueService;
        this.calloutService = services[3] as CalloutService;

        this.authUser = this.security.getServiceBackendIdentity(PowermeterService.NAME);

        logger.info("Initialized");
        callback();
    }

    schedule(job: CronJob, cron: CronService, _identity: BackendIdentity): void {
        if (job.jobType !== CronJobType.SMARTME_POWERMETER) return;
        if (!job.calloutId || !job.sensorId || !job.houseId) {
            logger.warn(`Smart-Me cron job <${job.id}> missing required fields — skipping`);
            return;
        }

        const jobName = `cronjob_${job.id}`;
        const cronExpression = `*/${job.frequencyMinutes} * * * *`;
        logger.info(`Scheduling Smart-Me cron job <${job.id}> every ${job.frequencyMinutes} min`);

        cron.add(jobName, cronExpression, async () => {
            if (objectHasOwnProperty_Trueish(process.env, "CRON_POWERMETER_SUBSCRIPTIONS_DISABLED")) {
                logger.warn(`Ignoring cron job due to CRON_POWERMETER_SUBSCRIPTIONS_DISABLED (${jobName})`);
                return;
            }
            await this.executePowermeterJob(job.id, job.sensorId!, job.calloutId!);
        }, false, { type: "cronjob", jobId: job.id, userId: job.userId, houseId: job.houseId, sensorId: job.sensorId });
    }

    unschedule(jobId: string, cron: CronService): void {
        cron.remove(`cronjob_${jobId}`);
    }

    private async executePowermeterJob(jobId: string, sensorId: string, calloutId: string) {
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
                    id: sensorId,
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
    }
}
