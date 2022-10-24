import {Watchdog, WatchdogFood} from "watchdog";
import constants from "../constants";
import { BaseService, Device, TopicControlMessage, ControlMessageTypes, BackendIdentity } from "../types";
import { Logger } from "../logger";
import { EventService } from "./event-service";
import { StorageService } from "./storage-service";
import { ISubscriptionResult } from "../configure-queues-topics";
import { IdentityService } from "./identity-service";
import {objectHasOwnProperty_Trueish} from "../utils";

const logger = new Logger("watchdog-service");
const _watchdogs : Map<string,Watchdog<string,string>> = new Map();

export interface WatchdogInfo {
    deviceId: string;
    left: number;
}

export class WatchdogService extends BaseService {
    public static NAME = "watchdog";

    eventService? : EventService;
    storageService? : StorageService;
    security : IdentityService;
    authUser : BackendIdentity;

    constructor() {
        super(WatchdogService.NAME);
        this.dependencies = [EventService.NAME, StorageService.NAME, IdentityService.NAME];
    }
    async init(callback : (err? : Error) => {}, services : BaseService[]) {
        this.eventService = services[0] as unknown as EventService;
        this.storageService = services[1] as unknown as StorageService;
        this.security = services[2] as unknown as IdentityService;

        // request auth token
        this.authUser = await this.security.getServiceBackendIdentity(WatchdogService.NAME);

        // callback
        callback();
        
        // init device watchdog for devices we know if allowed
        if (objectHasOwnProperty_Trueish(process.env, "WATCHDOG_DISABLED")) {
            logger.warn(`Ignoring watchdog setup due to WATCHDOG_DISABLED being set`);
            return;
        }
        this.initDeviceWatchdogs();
        
        // listen for messages when devices post data
        this.eventService!.subscribeTopic(constants.TOPICS.DEVICE, "known.#", this.deviceTopicMessages.bind(this));

        // listen for messages about devices coming and going
        this.eventService!.subscribeTopic(constants.TOPICS.CONTROL, "device.#", this.deviceControlMessages.bind(this));
    }
    getAll() : Record<string,WatchdogInfo> {
        const result : Record<string,WatchdogInfo> = {};
        for (const deviceId of _watchdogs.keys()) {
            const w = _watchdogs.get(deviceId)!;
            result[deviceId] = {
                deviceId,
                "left": w.left()
            } as WatchdogInfo;
        }
        return result;
    }

    private async initDeviceWatchdogs() {
        const devices = await this.storageService!.getAllDevices(this.authUser);
        devices.forEach(device => {
            // create a watchdog per device if active
            if (!device.active) {
                logger.info(
                    `NOT adding watchdog for device with ID <${device.id}> and name <${device.name}> as it's INACTIVE`
                );
            } else {
                logger.info(
                    `Adding watchdog for device with ID <${device.id}> and name <${device.name}> with timeout <${constants.DEFAULTS.WATCHDOG.DEFAULT_TIMEOUT}>`
                );
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
            logger.info(`Device (<${deviceId}>) reset`);
            
            // fetch device from db
            let device;
            try {
                device = await this.storageService?.getDevice(this.authUser, deviceId);
            } catch (err) {
                // device not found / no longer found
                logger.info(`Device for watchdog for ID <${deviceId}> not found in database removing`);
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
        logger.debug(`Feeding watchdog for deviceId <${deviceId}>`);
        if (_watchdogs.has(deviceId)) {
            _watchdogs.get(deviceId)!.feed({
                "timeout": constants.DEFAULTS.WATCHDOG.DEFAULT_TIMEOUT as number,
                "data": deviceId
            });
            logger.debug(`Fed watchdog for device with id <${deviceId}>`);
        }
    }

    private async deviceControlMessages(result : ISubscriptionResult) {
        const parts = result.routingKey!.split(".");
        if (parts[1] === "create") {
            // new device was created
            const deviceId = result.data.new.id;
            if (result.data.new.active) {
                logger.info(`Device with ID <${deviceId}> was created - adding watchdog`);
                this.addWatchdog(result.data.new as Device);
            } else {
                logger.info(`Device with ID <${deviceId}> was created INACTIVE - NOT adding watchdog`);
            }

        } else if (parts[1] === "update") {
            // device was updated
            const deviceId = result.data.new.id;

            if (result.data.new.active && !result.data.old.active) {
                // device now active - add watchdog
                logger.info(`Device with ID <${deviceId}> was updated - was INACTIVE, now ACTIVE - adding watchdog`);
                this.addWatchdog(result.data.new as Device);

            } else if (!result.data.new.active && result.data.old.active) {
                logger.info(`Device with ID <${deviceId}> was updated - was ACTIVE, now INACTIVE - removing watchdog`);
                this.removeWatchdog(deviceId);
            }

        } else if (parts[1] === "delete") {
            // device was deleted
            const deviceId = result.data.old.id;
            logger.info(`Device with ID <${deviceId}> was deleted - removing watchdog`);
            this.removeWatchdog(deviceId);
        }
    }
    
}
