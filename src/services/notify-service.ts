import Handlebars from "handlebars";
import { ISubscriptionResult } from "../configure-queues-topics";
import constants from "../constants";
import { Logger } from "../logger";
import pushover from "../pushover";
import { BackendIdentity, BaseService, Device, NotifyUsing, PushoverSettings, QueueNotifyMessage, Sensor } from "../types";
import { objectHasOwnProperty_Trueish } from "../utils";
import { AlertEventType } from "./alert/alert-types";
import { EmailMessage, EmailService, RFC822Address } from "./email-service";
import { EventService } from "./event-service";
import { IdentityService } from "./identity-service";
import { StorageService } from "./storage-service";


type Template = {
    title: HandlebarsTemplateDelegate<any>;
    message: HandlebarsTemplateDelegate<any>;
};

const logger = new Logger("notify-service");

export class NotifyService extends BaseService {
    public static NAME = "notify";
    serviceUser!: BackendIdentity;
    eventService!: EventService;
    storage!: StorageService;
    email!: EmailService;
    templates = new Map<AlertEventType, Template>();

    constructor() {
        super(NotifyService.NAME);
        this.dependencies = [EventService.NAME, StorageService.NAME, EmailService.NAME, IdentityService.NAME];
    }

    init(callback: (err?: Error) => {}, services: BaseService[]) {
        this.eventService = services[0] as unknown as EventService;
        this.storage = services[1] as unknown as StorageService;
        this.email = services[2] as unknown as EmailService;
        const identity = services[3] as IdentityService;
        this.serviceUser = identity.getServiceBackendIdentity(NotifyService.NAME);

        // init templates
        this.initTemplates();

        // listen for device watchdog resets
        this.eventService.subscribeQueue(constants.QUEUES.NOTIFY, this.listenForNotify.bind(this));

        // callback
        callback();
    }

    private initTemplates() {
        this.templates.set(AlertEventType.onDeviceRestart, {
            title: Handlebars.compile(constants.NOTIFY.DEVICE.RESTART.TITLE),
            message: Handlebars.compile(constants.NOTIFY.DEVICE.RESTART.MESSAGE),
        });
        this.templates.set(AlertEventType.onDeviceTimeout, {
            title: Handlebars.compile(constants.NOTIFY.DEVICE.TIMEOUT.TITLE),
            message: Handlebars.compile(constants.NOTIFY.DEVICE.TIMEOUT.MESSAGE),
        });
        this.templates.set(AlertEventType.onSensorTimeout, {
            title: Handlebars.compile(constants.NOTIFY.SENSOR.TIMEOUT.TITLE),
            message: Handlebars.compile(constants.NOTIFY.SENSOR.TIMEOUT.MESSAGE),
        });
        this.templates.set(AlertEventType.onDeviceMessageNoSensor, {
            title: Handlebars.compile(constants.NOTIFY.DEVICE.NOSENSORS.TITLE),
            message: Handlebars.compile(constants.NOTIFY.DEVICE.NOSENSORS.MESSAGE),
        });
        this.templates.set(AlertEventType.onSensorValue, {
            title: Handlebars.compile(constants.NOTIFY.SENSOR.VALUE.TITLE),
            message: Handlebars.compile(constants.NOTIFY.SENSOR.VALUE.MESSAGE),
        });
    }

    private async listenForNotify(result: ISubscriptionResult) {
        // mark msg as consumed
        result.callback();
        
        // get data
        const data = result.data as QueueNotifyMessage;
        logger.debug(
            `Received message on ${result.exchangeName} for target id <${data.target}> data <${JSON.stringify(data)}>`
        );

        // get objects
        const userSettings = await this.storage.getNotificationSettingsForUser(this.serviceUser, data.userId);
        const user = userSettings.user;
        const sensor = [
            AlertEventType.onSensorSample,
            AlertEventType.onSensorValue,
            AlertEventType.onSensorTimeout,
        ].includes(data.eventType)
            ? await this.storage.getSensor(this.serviceUser, data.target)
            : undefined;
        const device = [
            AlertEventType.onDeviceMessage,
            AlertEventType.onDeviceMessageNoSensor,
            AlertEventType.onDeviceRestart,
            AlertEventType.onDeviceTimeout,
        ].includes(data.eventType)
            ? await this.storage.getDevice(this.serviceUser, data.target)
            : undefined;

        // create data for template merge
        const args = Object.assign(this.getDefaultData(), {
            alertId: data.alertId,
            notifyType: data.notifyType,
            eventType: data.eventType,
            user,
            sensor,
            device,
            data: data.data,
        });
        args.url.target = ((device: Device|undefined, sensor: Sensor|undefined) => {
            if (sensor) {
                return `${args.url.app}/#configuration/house/${sensor.device!.house.id}/device/${sensor.device!.id}/sensor/${sensor.id}`;
            } else if (device) {
                return `${args.url.app}/#configuration/house/${device.house.id}/device/${device!.id}`;
            }
        })(device, sensor);
        logger.trace(`Merging templates with args <${JSON.stringify(args)}>`);

        // get template
        const templ = this.templates.get(data.eventType);
        if (!templ) {
            return logger.error(`Unable to find template for ${data.eventType} - aborting!`);
        }
        const title = templ!.title(args);
        const message = templ!.message(args);

        // are notifications disabled
        if (objectHasOwnProperty_Trueish(process.env, "NOTIFICATIONS_DISABLED")) {
            logger.info(
                `NOTIFICATIONS_DISABLED set so not sending notification - type <${
                    data.notifyType
                }> args <${JSON.stringify(args)}>`
            );
            return;
        }

        if (NotifyUsing.email === data.notifyType) {
            // notify using email
            let email = user.email;
            if (!email) {
                logger.warn(`Cannot send email notification to user due to missing email address (id: ${user.id}, name: ${user.fn} ${user.ln})`);
                return;
            }
            if (process.env.NOTIFICATIONS_EMAIL_OVERRIDE) {
                logger.warn(
                    `NOTIFICATIONS_EMAIL_OVERRIDE is set so using that email <${process.env.NOTIFICATIONS_EMAIL_OVERRIDE}>`
                );    
                email = process.env.NOTIFICATIONS_EMAIL_OVERRIDE;
            }
            const msg = new EmailMessage();
            msg.to = new RFC822Address(`${user.fn} ${user.ln}`, email);
            msg.from = new RFC822Address(constants.APP.NAME, email);
            msg.subject = title;
            msg.body = message;
            this.email.send(msg);
        } else if (NotifyUsing.pushover === data.notifyType && userSettings.pushover) {
            // pushover
            pushover({
                title,
                message,
                settings: { userkey: userSettings.pushover.userkey, apptoken: userSettings.pushover.apptoken } as PushoverSettings,
            });
        }
    }

    private getDefaultData(): any {
        const data = {
            app: {
                name: constants.APP.NAME,
                prococol: constants.APP.PROTOCOL,
                domain: constants.APP.DOMAIN,
                commit: constants.APP.GITCOMMIT
            },
            url: {
                app: `${constants.APP.PROTOCOL}://${constants.APP.DOMAIN}`
            }
        };
        return data;
    }
}
