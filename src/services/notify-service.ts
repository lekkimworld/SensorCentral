import {Moment} from "moment-timezone";
import constants from "../constants";
import { BaseService, TopicControlMessage, WatchdogNotification, NotifyUsing, Device } from "../types";
import { LogService } from "./log-service";
import { EventService } from "./event-service";
import { StorageService } from "./storage-service";
import { ISubscriptionResult } from "../configure-queues-topics";
import pushover from "../pushover";
import moment from "moment";
import { EmailService, EmailMessage, RFC822Address } from "./email-service";

export class NotifyService extends BaseService {
    pushoverLastSent? : Moment;
    logService? : LogService;
    eventService? : EventService;
    storage? : StorageService;
    email? : EmailService;

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
        this.eventService.subscribeTopic(constants.TOPICS.CONTROL, "known.watchdogReset", this.listenForDeviceWatchdogResets.bind(this));

        // listen for device watchdog resets
        this.eventService.subscribeTopic(constants.TOPICS.CONTROL, "known.restart", this.listenForceDeviceRestarts.bind(this));

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
            this.logService?.warn(`Received device watchdog reset message without device attached <${msg.deviceId}> - ignoring`);
            return;
        }

        this.notifyNotifiers(
            msg.device, 
            `Device restart`, 
            `Device restart (${msg.device.id} / ${msg.device.name}) - maybe it didn't pat the watchdog?`
        );
    }

    private async listenForDeviceWatchdogResets(result : ISubscriptionResult) {
        this.logService!.debug(`Notify service received message on topic ${result.routingKey} with payload=${JSON.stringify(result.data)}`);
        const msg = result.data as TopicControlMessage;
        if (!msg.device) {
            this.logService?.warn(`Received device watchdog reset message without device attached <${msg.deviceId}> - ignoring`);
            return;
        }

        this.notifyNotifiers(
            msg.device, 
            `Device watchdog`, 
            `Watchdog for device (${msg.device!.id} / ${msg.device!.name}) reset meaning we received no communication from it in ${constants.DEFAULTS.WATCHDOG.DEFAULT_TIMEOUT} ms (${constants.DEFAULTS.WATCHDOG.DEFAULT_TIMEOUT / 60000} minutes)`
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
                msg.from = new RFC822Address(`SensorCentral`, n.user.email);
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
