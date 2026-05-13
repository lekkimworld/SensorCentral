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

        // listen for subscription events
        this.pubsub.subscribe(
            `${constants.TOPICS.CONTROL}.powermeter_subscription.delete`,
            this.listenForPowermeterSubscriptionRemove.bind(this)
        );
        this.pubsub.subscribe(
            `${constants.TOPICS.CONTROL}.powermeter_subscription.create`,
            this.listenForPowermeterSubscriptionCreate.bind(this)
        );

        // get all subscriptions
        const subs = await this.storageService!.getAllPowermeterSubscriptions(this.authUser);
        subs.forEach((sub) => {
            this.addCronJob(sub.house.id, sub.sensor.deviceId, sub.sensor.id, sub.frequency, sub.calloutId);
        });

        // callback
        callback();
    }

    private logAndGetMessage(result: TopicMessage): any {
        logger.debug(
            `Powermeter Subscription service received message on channel ${
                result.channel
            } with payload=${JSON.stringify(result.data)}`
        );
        const msg = result.data as any;
        return msg;
    }

    private getJobName(houseId: string): string {
        const jobName = `powermeter_subscription_${houseId}>`;
        return jobName;
    }

    private async executeCronJob(houseId: string, deviceId: string, sensorId: string, calloutId: string) {
        try {
            // use callout service to fetch device data from Smart-Me via OAuth
            const deviceData = await this.calloutService.calloutById<any>(this.authUser, calloutId, { sensorId }, { accept: "application/json" });
            if (!deviceData) {
                logger.warn(
                    `Unable to find device data for sensor we queried for - house <${houseId}> sensor <${sensorId}>`
                );
                return;
            }

            const parsed = new SmartmeDeviceWithDataType(deviceData);

            // publish a device event to feed watchdog
            const payload: IngestedDeviceMessage = {
                id: deviceId,
            };

            // see if counter reading is in kwh - if yes convert to wh
            if (parsed.counterReadingUnit === PowerUnit.kWh) {
                logger.debug(
                    `Powermeter counterReading is <${parsed.counterReading}> but counterReadingUnit is kWh - multiplying by 1000`
                );
                parsed.counterReading = parsed.counterReading * 1000;
                parsed.counterReadingImport = parsed.counterReadingImport * 1000;
                logger.debug(`Powermeter counterReading is now <${parsed.counterReading}> Wh`);
            }

            // publish event to store as regular sensor
            this.queues.publish(constants.QUEUES.DEVICE, payload).then(() => {
                // send event to persist as sensor_data
                this.queues.publish(constants.QUEUES.SENSOR, {
                    deviceId: deviceId,
                    id: parsed.id,
                    dt: parsed.valueDate.toISOString(),
                    value: parsed.counterReadingImport,
                } as IngestedSensorMessage);
            });

            // persist full powermeter reading
            this.storageService!.persistPowermeterReadingFromDeviceRequest(parsed);
        } catch (err: any) {
            if (err instanceof Cloudflare524Error) {
                logger.warn(`Unable to get downstream resource due to Cloudflare 524 (${err.message})`);
            } else {
                logger.warn(`Unable to execute cron job due to unexpected error (${err.message})`);
            }
        }
    }

    private addCronJob(houseId: string, deviceId: string, sensorId: string, frequency: number, calloutId: string) {
        logger.debug(`Creating powermeter subscription for house <${houseId}> frequency <${frequency}>`);
        const jobName = this.getJobName(houseId);
        this.cron.add(jobName, `*/${frequency} * * * *`, async () => {
            if (objectHasOwnProperty_Trueish(process.env, "CRON_POWERMETER_SUBSCRIPTIONS_DISABLED")) {
                logger.warn(
                    `Ignoring powermeter subscription cron job due to CRON_POWERMETER_SUBSCRIPTIONS_DISABLED (${jobName})`
                );
                return;
            }
            this.executeCronJob(houseId, deviceId, sensorId, calloutId);
        });
    }

    private async listenForPowermeterSubscriptionRemove(result: TopicMessage) {
        const msg = this.logAndGetMessage(result);
        this.cron.remove(this.getJobName(msg.old.id));
    }

    private async listenForPowermeterSubscriptionCreate(result: TopicMessage) {
        const msg = this.logAndGetMessage(result);
        this.addCronJob(msg.new.houseId, msg.new.deviceId, msg.new.sensorId, msg.new.frequency, msg.new.calloutId);
    }
}
