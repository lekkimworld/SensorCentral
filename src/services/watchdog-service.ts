import {Watchdog, WatchdogFood} from "watchdog";
import {constants} from "../constants";
import { BaseService, Device, TopicControlMessage, ControlMessageTypes } from "../types";
import { LogService } from "./log-service";
import { EventService } from "./event-service";
import { StorageService } from "./storage-service";
import { PushoverService } from "./pushover-service";
import { ISubscriptionResult } from "../configure-queues-topics";

const _watchdogs : Map<String,Watchdog<string,Device>> = new Map();

export class WatchdogService extends BaseService {
    logService? : LogService;
    eventService? : EventService;
    storageService? : StorageService;
    pushService? : PushoverService;

    constructor() {
        super("watchdog");
        this.dependencies = ["log","event","storage","pushover"];
    }
    init(callback : (err? : Error) => {}, services : BaseService[]) {
        this.logService = services[0] as unknown as LogService;
        this.eventService = services[1] as unknown as EventService;
        this.storageService = services[2] as unknown as StorageService;
        this.pushService = services[3] as unknown as PushoverService;
        
        // create watchdogs for all known devices
        this.storageService.getDevices().then(devices => {
            devices.forEach(device => {
                // create a watchdog per device
                this.logService!.info(`Adding watchdog for device with ID <${device.id}> and name <${device.name}> with timeout <${constants.DEFAULTS.WATCHDOG.DEFAULT_TIMEOUT}>`)
                let w = new Watchdog(constants.DEFAULTS.WATCHDOG.DEFAULT_TIMEOUT as number, device.id);
                
                // listen for resets
                //@ts-ignore
                w.on('reset', (food: WatchdogFood<string, Device>, time: number) => {
                    // log
                    this.logService!.info(`Device (<${device.id}> / <${device.name}>) reset`);
                    
                    // refetch device from db
                    this.storageService?.getDeviceById(device.id).then(device => {
                        // feed watchdog
                        w.feed({
                            "data": device
                        })

                        // publish on topic
                        const payload : TopicControlMessage = {
                            "type": ControlMessageTypes.watchdogReset,
                            "device": device,
                            "deviceId": device.id
                        }
                        this.eventService!.publishTopic(constants.TOPICS.CONTROL, "known.watchdogReset", payload);
                    })
                })

                // feed watchdog
                w.feed({
                    "data": device
                });
                _watchdogs.set(device.id, w);
            })
        })

        // listen to event service to feed watchdog on events
        this.eventService.subscribeTopic(constants.TOPICS.DEVICE, "known.#", (result : ISubscriptionResult) => {
            // get device id
            const msg = result.data as TopicControlMessage;

            // feed watchdog
            if (_watchdogs.has(msg.deviceId) && msg.device) {
                _watchdogs.get(msg.deviceId)!.feed({
                    "data": msg.device
                });
                this.logService!.debug(`Fed watchdog for device with id <${msg.deviceId}> (<${JSON.stringify(msg.device)}>)`);
            }
        });

        // callback
        callback();
    }
}
