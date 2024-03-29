import constants from "../constants";
import {
    BackendIdentity,
    BaseService,
    IngestedDeviceMessage,
    IngestedSensorMessage,

} from "../types";
import {smartmeGetDevices, PowerUnit, Cloudflare524Error} from "../resolvers/smartme";
import { Logger } from "../logger";
import { PubsubService, TopicMessage } from "./pubsub-service";
import { StorageService } from "./storage-service";
import { IdentityService } from "./identity-service";
import { InvalidInputError, InvalidSignatureError, verifyPayload } from "../smartme-signature";
import { CronService } from "./cron-service";
import {objectHasOwnProperty_Trueish} from "../utils";
import { QueueService } from "./queue-service";

const logger = new Logger("powermeter-service");

export class PowermeterService extends BaseService {
    public static NAME = "powermeter";
    pubsub!: PubsubService;
    queues!: QueueService;
    storageService!: StorageService;
    security!: IdentityService;
    cron!: CronService;
    authUser!: BackendIdentity;

    constructor() {
        super(PowermeterService.NAME);
        this.dependencies = [
            PubsubService.NAME,
            StorageService.NAME,
            IdentityService.NAME,
            CronService.NAME,
            QueueService.NAME,
        ];
    }

    async init(callback: (err?: Error) => {}, services: BaseService[]) {
        this.pubsub = services[0] as PubsubService;
        this.storageService = services[1] as StorageService;
        this.security = services[2] as IdentityService;
        this.cron = services[3] as CronService;
        this.queues = services[4] as QueueService;

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
            this.addCronJob(sub.house.id, sub.sensor.deviceId, sub.sensor.id, sub.frequency, sub.encryptedCredentials);
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

    private async executeCronJob(houseId: string, deviceId: string, sensorId: string, cipherText: string) {
        try {
            const creds = verifyPayload(cipherText);
            const deviceData = await smartmeGetDevices(creds.username, creds.password, sensorId);
            if (!deviceData) {
                logger.warn(
                    `Unable to find device data for sensor we queried for - house <${houseId}> sensor <${sensorId}>`
                );
            } else if (Array.isArray(deviceData)) {
                logger.warn(`Received an array of Smartme device data instances - expected a single instance`);
            } else {
                // publish a device event to feed watchdog
                const payload: IngestedDeviceMessage = {
                    id: deviceId,
                };

                // see if counter reading is in kwh - if yes convert to wh
                if (deviceData.counterReadingUnit === PowerUnit.kWh) {
                    logger.debug(
                        `Powermeter counterReading is <${deviceData.counterReading}> but counterReadingUnit is kWh - multiplying by 1000`
                    );
                    deviceData.counterReading = deviceData.counterReading * 1000;
                    deviceData.counterReadingImport = deviceData.counterReadingImport * 1000;
                    logger.debug(`Powermeter counterReading is now <${deviceData.counterReading}> Wh`);
                }

                // publish event to store as regular sensor
                this.queues.publish(constants.QUEUES.DEVICE, payload).then(() => {
                    // send event to persist as sensor_data
                    this.queues.publish(constants.QUEUES.SENSOR, {
                        deviceId: deviceId,
                        id: deviceData.id,
                        dt: deviceData.valueDate.toISOString(),
                        value: deviceData.counterReadingImport,
                    } as IngestedSensorMessage);
                });

                // persist full powermeter reading
                this.storageService!.persistPowermeterReadingFromDeviceRequest(deviceData);
            }
        } catch (err) {
            if (err instanceof InvalidSignatureError) {
                logger.error(`Unable to execute cron job due to invalid signature on ciphertext (${err.message})`);
            } else if (err instanceof InvalidInputError) {
                logger.error(`Unable to execute cron job due to invalid input (${err.message})`);
            } else if (err instanceof Cloudflare524Error) {
                logger.warn(`Unable to get downsteam resource due to Cloudflare 524 (${err.message})`);
            } else {
                logger.warn(`Unable to execute cron job due to unexpected error (${err.message})`);
            }
        }
    }

    private addCronJob(houseId: string, deviceId: string, sensorId: string, frequency: number, cipherText: string) {
        logger.debug(`Creating powermeter subscription for house <${houseId}> frequency <${frequency}>`);
        const jobName = this.getJobName(houseId);
        this.cron.add(jobName, `*/${frequency} * * * *`, async () => {
            if (objectHasOwnProperty_Trueish(process.env, "CRON_POWERMETER_SUBSCRIPTIONS_DISABLED")) {
                logger.warn(
                    `Ignoring powermeter subscription cron job due to CRON_POWERMETER_SUBSCRIPTIONS_DISABLED (${jobName})`
                );
                return;
            }
            this.executeCronJob(houseId, deviceId, sensorId, cipherText);
        });
    }

    private async listenForPowermeterSubscriptionRemove(result: TopicMessage) {
        const msg = this.logAndGetMessage(result);
        this.cron.remove(this.getJobName(msg.old.id));
    }

    private async listenForPowermeterSubscriptionCreate(result: TopicMessage) {
        const msg = this.logAndGetMessage(result);
        this.addCronJob(msg.new.houseId, msg.new.deviceId, msg.new.sensorId, msg.new.frequency, msg.new.cipherText);
    }
}
