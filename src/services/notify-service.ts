import {Moment} from "moment-timezone";
import constants from "../constants";
import { BaseService, TopicControlMessage, WatchdogNotification, NotifyUsing, Device, ControlMessageTypes } from "../types";
import { Logger } from "../logger";
import { EventService } from "./event-service";
import { StorageService } from "./storage-service";
import { ISubscriptionResult } from "../configure-queues-topics";
import pushover from "../pushover";
import moment from "moment";
import { EmailService, EmailMessage, RFC822Address } from "./email-service";
import Handlebars from "handlebars";

const logger = new Logger("notify-service");

export class NotifyService extends BaseService {
    public static NAME = "notify";
    pushoverLastSent? : Moment;
    eventService? : EventService;
    storage? : StorageService;
    email? : EmailService;
    templates = new Map<string,any>();

    constructor() {
        super(NotifyService.NAME);
        this.dependencies = [EventService.NAME, StorageService.NAME, EmailService.NAME];
    }

    init(callback : (err? : Error) => {}, services : BaseService[]) {
        this.eventService = services[0] as unknown as EventService;
        this.storage = services[1] as unknown as StorageService;
        this.email = services[2] as unknown as EmailService;

        // listen for device watchdog resets
        this.eventService.subscribeTopic(constants.TOPICS.CONTROL, `known.${ControlMessageTypes.watchdogReset}`, this.listenForDeviceWatchdogResets.bind(this));

        // listen for device watchdog resets
        this.eventService.subscribeTopic(constants.TOPICS.CONTROL, `known.${ControlMessageTypes.restart}`, this.listenForceDeviceRestarts.bind(this));

        // listen for device pings without sensor data
        this.eventService.subscribeTopic(constants.TOPICS.CONTROL, `known.${ControlMessageTypes.noSensorData}`, this.listenForNoSensors.bind(this));

        // compile templates
        this.templates.set("device.restart.title", Handlebars.compile(constants.DEFAULTS.NOTIFY.DEVICE.RESTART.TITLE));
        this.templates.set("device.restart.message", Handlebars.compile(constants.DEFAULTS.NOTIFY.DEVICE.RESTART.MESSAGE));
        this.templates.set("device.reset.title", Handlebars.compile(constants.DEFAULTS.NOTIFY.DEVICE.RESET.TITLE));
        this.templates.set("device.reset.message", Handlebars.compile(constants.DEFAULTS.NOTIFY.DEVICE.RESET.MESSAGE));
        this.templates.set("device.noSensors.title", Handlebars.compile(constants.DEFAULTS.NOTIFY.DEVICE.NOSENSORS.TITLE));
        this.templates.set("device.noSensors.message", Handlebars.compile(constants.DEFAULTS.NOTIFY.DEVICE.NOSENSORS.MESSAGE));

        // callback
        callback();
    }

    private getDefaultData(msg : TopicControlMessage) : any {
        const data = {
            appurl: `${constants.APP.PROTOCOL}://${constants.APP.DOMAIN}`,
            appname: constants.APP.NAME,
            device: msg.device,
        };
        return data;
    }

    private async listenForceDeviceRestarts(result : ISubscriptionResult) {
        logger.debug(
            `Notify service received message on topic ${result.routingKey} with payload=${JSON.stringify(result.data)}`
        );
        const msg = result.data as TopicControlMessage;
        if (!msg.device) {
            logger.warn(`Received device restart message without device attached <${msg.deviceId}> - ignoring`);
            return;
        }

        const data = this.getDefaultData(msg);
        this.notifyNotifiers(
            msg.device, 
            this.templates.get("device.restart.title")(data),
            this.templates.get("device.restart.message")(data)
        );
    }

    private async listenForDeviceWatchdogResets(result : ISubscriptionResult) {
        logger.debug(
            `Notify service received message on topic ${result.routingKey} with payload=${JSON.stringify(result.data)}`
        );
        const msg = result.data as TopicControlMessage;
        if (!msg.device) {
            logger.warn(`Received device watchdog reset message without device attached <${msg.deviceId}> - ignoring`);
            return;
        }

        const data = Object.assign({
            timeout: {
                ms: constants.DEFAULTS.WATCHDOG.DEFAULT_TIMEOUT,
                minutes: constants.DEFAULTS.WATCHDOG.DEFAULT_TIMEOUT / 60000,
            },
        }, this.getDefaultData(msg));
        this.notifyNotifiers(
            msg.device, 
            this.templates.get("device.reset.title")(data),
            this.templates.get("device.reset.message")(data)
        );
    }

    private async listenForNoSensors(result : ISubscriptionResult) {
        logger.debug(
            `Notify service received message on topic ${result.routingKey} with payload=${JSON.stringify(result.data)}`
        );
        const msg = result.data as TopicControlMessage;
        if (!msg.device) {
            logger.warn(`Received noSensors message without device attached <${msg.deviceId}> - ignoring`);
            return;
        }

        const data = this.getDefaultData(msg);
        this.notifyNotifiers(
            msg.device, 
            this.templates.get("device.noSensors.title")(data),
            this.templates.get("device.noSensors.message")(data)
        );
    }

    private async notifyNotifiers(device : Device, title : string, message: string) {
        if (process.env.NOTIFICATIONS_DISABLED) {
            logger.warn(
                `Ignoring sending "${title}"-notification for device ${device.id} due to NOTIFICATIONS_DISABLED`
            );
            return;
        }
        
        const notifiers = await this.storage!.getDeviceWatchdogNotifiers(device.id);
        logger.debug(`Received <${notifiers.length}> notifiers for device with ID <${device.id}>`);
        notifiers.forEach(n => {
            if (n.notify === WatchdogNotification.no) return;
            if (n.notify === WatchdogNotification.muted && moment(n.mutedUntil).isAfter(moment.utc())) return;

            if (n.settings.notifyUsing === NotifyUsing.email && n.user.email) {
                // notify using email
                const msg = new EmailMessage();
                msg.to = new RFC822Address(`${n.user.fn} ${n.user.ln}`, n.user.email);
                msg.from = new RFC822Address(constants.APP.NAME, n.user.email);
                msg.subject = title;
                msg.body = message;
                this.email!.send(msg);

            } else if (n.settings.notifyUsing === NotifyUsing.pushover && n.settings.pushover) {
                // notify using pushover
                pushover({
                    title, 
                    message,
                    "settings": n.settings.pushover
                });
            }
        });
    }

}
