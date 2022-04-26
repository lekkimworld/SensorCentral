import constants from "../constants";
import {
    BackendIdentity,
    BaseService,

} from "../types";
import {getSmartmeDevices} from "../resolvers/smartme";
import { LogService } from "./log-service";
import { EventService } from "./event-service";
import { ISubscriptionResult } from "../configure-queues-topics";
import { StorageService } from "./storage-service";
import { IdentityService } from "./identity-service";
import { verifyPayload } from "../smartme-signature";
import { CronService } from "./cron-service";

export class PowermeterService extends BaseService {
    public static NAME = "powermeter";
    logService?: LogService;
    eventService?: EventService;
    storageService?: StorageService;
    security: IdentityService;
    cron: CronService;
    authUser: BackendIdentity;

    constructor() {
        super(PowermeterService.NAME);
        this.dependencies = [LogService.NAME, EventService.NAME, StorageService.NAME, IdentityService.NAME, CronService.NAME];
    }

    async init(callback: (err?: Error) => {}, services: BaseService[]) {
        this.logService = services[0] as unknown as LogService;
        this.eventService = services[1] as unknown as EventService;
        this.storageService = services[2] as unknown as StorageService;
        this.security = services[3] as IdentityService;
        this.cron = services[4] as CronService;

        // get auth user for service
        this.authUser = await this.security.getServiceBackendIdentity(PowermeterService.NAME);

        // listen for subscription events
        this.eventService.subscribeTopic(
            constants.TOPICS.CONTROL,
            "powermeter_subscription.delete",
            this.listenForPowermeterSubscriptionRemove.bind(this)
        );
        this.eventService.subscribeTopic(
            constants.TOPICS.CONTROL,
            "powermeter_subscription.create",
            this.listenForPowermeterSubscriptionCreate.bind(this)
        );

        // get all subscriptions
        const subs = await this.storageService!.getPowermeterSubscriptions(this.authUser);
        subs.forEach(sub => {
            this.addCronJob(sub.house.id, sub.sensor.id, sub.frequency, sub.encryptedCredentials);
        })

        // callback
        callback();
    }

    private logAndGetMessage(result: ISubscriptionResult): any {
        this.logService!.debug(
            `Powermeter Subscription service received message on topic ${
                result.routingKey
            } with payload=${JSON.stringify(result.data)}`
        );
        const msg = result.data as any;
        return msg;
    }

    private addCronJob(houseId : string, sensorId : string, frequency : number, cipherText : string) {
        this.logService!.debug(
            `Creating powermeter subscription for house <${houseId}> frequency <${frequency}>`
        );
        const jobName = `powermeter_subscription_${houseId}>`;
        this.cron.add(jobName, `*/${frequency} * * * *`, async () => {
            const creds = verifyPayload(cipherText);
            const deviceData = await getSmartmeDevices(creds.username, creds.password, sensorId);
            if (!deviceData) {
                this.logService!.warn(`Unable to find device data for sensor we queried for - house <${houseId}> sensor <${sensorId}>`);
            } else if (Array.isArray(deviceData)) {
                this.logService!.warn(`Received an array of Smartme device data instances - expected a single instance`);
            } else {
                this.storageService?.persistPowermeterReadingFromDeviceRequest(deviceData);
            }
        });
    }

    private async listenForPowermeterSubscriptionRemove(result: ISubscriptionResult) {
        const msg = this.logAndGetMessage(result);
        this.cron.remove(`powermeter_subscription_${msg.old.id}`)
    }

    private async listenForPowermeterSubscriptionCreate(result: ISubscriptionResult) {
        const msg = this.logAndGetMessage(result);
        this.addCronJob(msg.new.houseId, msg.new.sensorId, msg.new.frequency, msg.new.cipherText);
    }
}
