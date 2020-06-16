import {Watchdog, WatchdogFood} from "watchdog";
import constants from "../constants";
import { BaseService, Device, TopicControlMessage, ControlMessageTypes } from "../types";
import { LogService } from "./log-service";
import { EventService } from "./event-service";
import { StorageService } from "./storage-service";
import { ISubscriptionResult } from "../configure-queues-topics";

const _watchdogs : Map<String,Watchdog<string,string>> = new Map();

export class WatchdogService extends BaseService {
    logService? : LogService;
    eventService? : EventService;
    storageService? : StorageService;

    constructor() {
        super("watchdog");
        this.dependencies = ["log","event","storage"];
    }
    async init(callback : (err? : Error) => {}, services : BaseService[]) {
        this.logService = services[0] as unknown as LogService;
        this.eventService = services[1] as unknown as EventService;
        this.storageService = services[2] as unknown as StorageService;

        // callback
        callback();
        
        // init device watchdog for devices we know
        this.initDeviceWatchdogs();

        // listen for messages when devices post data
        this.eventService!.subscribeTopic(constants.TOPICS.DEVICE, "known.#", this.deviceTopicMessages.bind(this));

        // listen for messages about devices coming and going
        this.eventService!.subscribeTopic(constants.TOPICS.CONTROL, "device.#", this.deviceControlMessages.bind(this));
    }

    private async initDeviceWatchdogs() {
        const devices = await this.storageService!.getDevices();
        devices.forEach(device => {
            // create a watchdog per device if active
            if (!device.active) {
                this.logService!.info(`NOT adding watchdog for device with ID <${device.id}> and name <${device.name}> as it's INACTIVE`);
            } else {
                this.logService!.info(`Adding watchdog for device with ID <${device.id}> and name <${device.name}> with timeout <${constants.DEFAULTS.WATCHDOG.DEFAULT_TIMEOUT}>`)
                this.addWatchdog(device);
            }
        })
    }

    private addWatchdog(device : Device) {
        let w = new Watchdog(constants.DEFAULTS.WATCHDOG.DEFAULT_TIMEOUT as number);
        
        // listen for resets
        w.on('reset', async (food: WatchdogFood<string, string>) => {
            // get device id
            const deviceId = food.data;

            // log
            this.logService!.info(`Device (<${deviceId}>) reset`);
            
            // fetch device from db
            let device;
            try {
                device = await this.storageService?.getDevice(deviceId);
            } catch (err) {
                // device not found / no longer found
                this.logService?.info(`Device for watchdog for ID <${deviceId}> not found in database removing`);
                return this.removeWatchdog(deviceId);
            }
            
            // feed watchdog
            this.feedWatchdog(deviceId);
            
            // publish on topic
            const payload : TopicControlMessage = {
                "type": ControlMessageTypes.watchdogReset,
                "device": device,
                "deviceId": deviceId
            }
            this.eventService!.publishTopic(constants.TOPICS.CONTROL, "known.watchdogReset", payload);

        })

        // add to cache
        _watchdogs.set(device.id, w);

        // feed watchdog
        this.feedWatchdog(device.id);
    }

    private removeWatchdog(deviceId : string) {
        const w = _watchdogs.get(deviceId);
        if (w) {
            w.sleep();
        }
        _watchdogs.delete(deviceId);
    }

    private async deviceTopicMessages(result : ISubscriptionResult) {
        // get device id
        const msg = result.data as TopicControlMessage;

        // feed watchdog
        this.feedWatchdog(msg.deviceId);
    }

    private feedWatchdog(deviceId : string) {
        if (_watchdogs.has(deviceId)) {
            _watchdogs.get(deviceId)!.feed({
                "timeout": constants.DEFAULTS.WATCHDOG.DEFAULT_TIMEOUT as number,
                "data": deviceId
            });
            this.logService!.debug(`Fed watchdog for device with id <${deviceId}>`);
        }
    }

    private async deviceControlMessages(result : ISubscriptionResult) {
        const parts = result.routingKey!.split(".");
        if (parts[1] === "create") {
            // new device was created
            const deviceId = result.data.new.id;
            this.logService!.info(`Device with ID <${deviceId}> was created - adding watchdog`);
            this.addWatchdog(result.data.new as Device);

        } else if (parts[1] === "update") {
            // device was updated
            const deviceId = result.data.new.id;

            if (result.data.new.active && !result.data.old.active) {
                // device now active - add watchdog
                this.logService!.info(`Device with ID <${deviceId}> was updated - was INACTIVE, now ACTIVE - adding watchdog`);
                this.addWatchdog(result.data.new as Device);

            } else if (!result.data.new.active && result.data.old.active) {
                this.logService!.info(`Device with ID <${deviceId}> was updated - was ACTIVE, now INACTIVE - removing watchdog`);
                this.removeWatchdog(deviceId);
            }

        } else if (parts[1] === "delete") {
            // device was deleted
            const deviceId = result.data.old.id;
            this.logService!.info(`Device with ID <${deviceId}> was deleted - removing watchdog`);
            this.removeWatchdog(deviceId);
        }
    }
    
}
