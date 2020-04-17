import {Moment} from "moment-timezone";
import constants from "../constants";
import { BaseService, TopicControlMessage, ControlMessageTypes, TopicSensorMessage, WatchdogNotification } from "../types";
import { LogService } from "./log-service";
import { EventService } from "./event-service";
import { PushoverService } from "./pushover-service";
import { StorageService } from "./storage-service";
import { ISubscriptionResult } from "../configure-queues-topics";
import * as moment from "moment";

export class NotifyService extends BaseService {
    pushoverLastSent? : Moment;
    logService? : LogService;
    eventService? : EventService;
    pushoverService? : PushoverService;
    storage? : StorageService;

    constructor() {
        super("notify");
        this.dependencies = ['log','event','pushover','storage'];
    }

    init(callback : (err? : Error) => {}, services : BaseService[]) {
        this.logService = services[0] as unknown as LogService;
        this.eventService = services[1] as unknown as EventService;
        this.pushoverService = services[2] as unknown as PushoverService;
        this.storage = services[3] as unknown as StorageService;

        this.eventService.subscribeTopic(constants.TOPICS.CONTROL, "known.#", (result : ISubscriptionResult) => {
            this.logService!.debug(`Notify service received message on topic ${result.routingKey} with payload=${JSON.stringify(result.data)}`);
            const msg = result.data as TopicControlMessage;

            // get muted status
            const notify = (() => {
                if (msg.device) {
                    if (msg.device.notify === WatchdogNotification.no) {
                        return WatchdogNotification.no;
                    } else if (msg.device.notify === WatchdogNotification.yes) {
                        return WatchdogNotification.yes;
                    } else if (msg.device.notify === WatchdogNotification.muted) {
                        //@ts-ignore
                        const d = Date.parse(msg.device.mutedUntil);
                        if (d < Date.now()) {
                            // not muted as until reached
                            return WatchdogNotification.yes;
                        } else {
                            // muted due to until
                            return WatchdogNotification.no;
                        }
                    }
                }

                // no device so mute
                return WatchdogNotification.no;
            })();
            if (WatchdogNotification.no === notify) {
                this.logService!.debug(`Notify service ignoring message as notify computed to no`);
                return;
            }

            // process based on type
            if (msg.type === ControlMessageTypes.restart) {
                // this is restart event - notify
                if (msg.device) {
                    // known device
                    this.pushoverService!.notify('Device restart', `Device restart (<${msg.device.id}> / <${msg.device.name}>) - maybe it didn't pat the watchdog?`)
                } else {
                    // unknown device
                    this.pushoverService!.notify('UNKNOWN Device restart', `UNKNOWN Device restart (<${msg.deviceId}>) - maybe it didn't pat the watchdog?`)
                }
            } else if (msg.type === ControlMessageTypes.watchdogReset) {
                // this is a watchdog event - notity
                if (msg.device) {
                    // known device
                    this.pushoverService!.notify(`Device watchdog`, `Watchdog for device (<${msg.device.id}> / <${msg.device.name}>) reset meaning we received no communication from it in ${constants.DEFAULTS.WATCHDOG.DEFAULT_TIMEOUT} ms (${constants.DEFAULTS.WATCHDOG.DEFAULT_TIMEOUT / 60000} minutes)`)
                } else {
                    // unknown device
                    this.pushoverService!.notify(`UNKNOWN Device watchdog`, `UNKNOWN Watchdog for device (<${msg.deviceId}>) reset meaning we received no communication from it in ${constants.DEFAULTS.WATCHDOG.DEFAULT_TIMEOUT} ms (${constants.DEFAULTS.WATCHDOG.DEFAULT_TIMEOUT / 60000} minutes)`)
                }
            }
            
        });

        this.eventService.subscribeTopic(constants.TOPICS.SENSOR, "known.#", (result : ISubscriptionResult) => {
            this.logService!.debug(`Notify service received message on exchange <${result.exchangeName}> and routingKey ${result.routingKey} with payload=${JSON.stringify(result.data)}`);
            const payload = result.data as TopicSensorMessage;
            // @ts-ignore
            if (payload.sensorId === '28FF46C76017059A' && payload.value < 0 && (!this.pushoverLastSent || moment().diff(this.pushoverLastSent, 'minutes') > 60)) {
                // @ts-ignore
                this.pushoverLastSent = moment();
                this.pushoverService!.notify('Frostvejr', `Det er frostvejr... (${payload.value})`)
            }

        });

        callback();
    }

}
