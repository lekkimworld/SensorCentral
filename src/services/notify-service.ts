import {Moment} from "moment-timezone";
import constants from "../constants";
import { BaseService, TopicControlMessage, WatchdogNotification, NotifyUsing, Device, ControlMessageTypes } from "../types";
import { LogService } from "./log-service";
import { EventService } from "./event-service";
import { StorageService } from "./storage-service";
import { ISubscriptionResult } from "../configure-queues-topics";
import pushover from "../pushover";
import moment from "moment";
import { EmailService, EmailMessage, RFC822Address } from "./email-service";
import Handlebars from "handlebars";

export class NotifyService extends BaseService {
    pushoverLastSent? : Moment;
    logService? : LogService;
    eventService? : EventService;
    storage? : StorageService;
    email? : EmailService;
    templates = new Map<string,any>();

    constructor() {
        super("notify");
        this.dependencies = ['log','event', 'storage', "email"];
    }

    init(callback : (err? : Error) => {}, services : BaseService[]) {
        this.logService = services[0] as unknown as LogService;
        this.eventService = services[1] as unknown as EventService;
        this.storage = services[2] as unknown as StorageService;
        this.email = services[3] as unknown as EmailService;

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
        
        /* this.eventService.subscribeTopic(constants.TOPICS.SENSOR, "known.#", (result : ISubscriptionResult) => {
            this.logService!.debug(`Notify service received message on exchange <${result.exchangeName}> and routingKey ${result.routingKey} with payload=${JSON.stringify(result.data)}`);
            const payload = result.data as TopicSensorMessage;
            // @ts-ignore
            if (payload.sensorId === '28FF46C76017059A' && payload.value < 0 && (!this.pushoverLastSent || moment().diff(this.pushoverLastSent, 'minutes') > 60)) {
                // @ts-ignore
                this.pushoverLastSent = moment();
                this.pushoverService!.notify('Frostvejr', `Det er frostvejr... (${payload.value})`)
            }

        }); */

        // callback
        callback();
    }

    private async listenForceDeviceRestarts(result : ISubscriptionResult) {
        this.logService!.debug(`Notify service received message on topic ${result.routingKey} with payload=${JSON.stringify(result.data)}`);
        const msg = result.data as TopicControlMessage;
        if (!msg.device) {
            this.logService?.warn(`Received device restart message without device attached <${msg.deviceId}> - ignoring`);
            return;
        }

        const data = {
            "appname": constants.APPNAME,
            "device": msg.device,
        }
        this.notifyNotifiers(
            msg.device, 
            this.templates.get("device.restart.title")(data),
            this.templates.get("device.restart.message")(data)
        );
    }

    private async listenForDeviceWatchdogResets(result : ISubscriptionResult) {
        this.logService!.debug(`Notify service received message on topic ${result.routingKey} with payload=${JSON.stringify(result.data)}`);
        const msg = result.data as TopicControlMessage;
        if (!msg.device) {
            this.logService?.warn(`Received device watchdog reset message without device attached <${msg.deviceId}> - ignoring`);
            return;
        }

        const data = {
            "appname": constants.APPNAME,
            "device": msg.device,
            "timeout": {
                "ms": constants.DEFAULTS.WATCHDOG.DEFAULT_TIMEOUT,
                "minutes": constants.DEFAULTS.WATCHDOG.DEFAULT_TIMEOUT / 60000
            }
        }
        this.notifyNotifiers(
            msg.device, 
            this.templates.get("device.reset.title")(data),
            this.templates.get("device.reset.message")(data)
        );
    }

    private async listenForNoSensors(result : ISubscriptionResult) {
        this.logService!.debug(`Notify service received message on topic ${result.routingKey} with payload=${JSON.stringify(result.data)}`);
        const msg = result.data as TopicControlMessage;
        if (!msg.device) {
            this.logService?.warn(`Received noSensors message without device attached <${msg.deviceId}> - ignoring`);
            return;
        }

        const data = {
            "appname": constants.APPNAME,
            "device": msg.device
        }
        this.notifyNotifiers(
            msg.device, 
            this.templates.get("device.noSensors.title")(data),
            this.templates.get("device.noSensors.message")(data)
        );
    }

    private async notifyNotifiers(device : Device, title : string, message: string) {
        const notifiers = await this.storage!.getDeviceWatchdogNotifiers(device.id);
        this.logService?.debug(`Received <${notifiers.length}> notifiers for device with ID <${device.id}>`);
        notifiers.forEach(n => {
            if (n.notify === WatchdogNotification.no) return;
            if (n.notify === WatchdogNotification.muted && moment(n.mutedUntil).isAfter(moment.utc())) return;

            if (n.settings.notifyUsing === NotifyUsing.email && n.user.email) {
                // notify using email
                const msg = new EmailMessage();
                msg.to = new RFC822Address(`${n.user.fn} ${n.user.ln}`, n.user.email);
                msg.from = new RFC822Address(constants.APPNAME, n.user.email);
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
