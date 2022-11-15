import {Watchdog, WatchdogFood} from "watchdog";
import constants from "../constants";
import { BaseService, Device, TopicControlMessage, ControlMessageTypes, BackendIdentity, SensorType, Sensor } from "../types";
import { Logger } from "../logger";
import { EventService } from "./event-service";
import { StorageService } from "./storage-service";
import { ISubscriptionResult } from "../configure-queues-topics";
import { IdentityService } from "./identity-service";
import {objectHasOwnProperty_Trueish} from "../utils";
import moment from "moment";

const logger = new Logger("watchdog-service");
const _deviceWatchdogs : Map<string,Watchdog<string,string>> = new Map();
const _sensorWatchdogs: Map<string, Watchdog<string, string>> = new Map();

export interface WatchdogInfo {
    id: string;
    left: number;
}

export class WatchdogService extends BaseService {
    public static NAME = "watchdog";

    eventService?: EventService;
    storageService?: StorageService;
    security: IdentityService;
    authUser: BackendIdentity;

    constructor() {
        super(WatchdogService.NAME);
        this.dependencies = [EventService.NAME, StorageService.NAME, IdentityService.NAME];
    }
    async init(callback: (err?: Error) => {}, services: BaseService[]) {
        this.eventService = services[0] as unknown as EventService;
        this.storageService = services[1] as unknown as StorageService;
        this.security = services[2] as unknown as IdentityService;

        // request auth token
        this.authUser = await this.security.getServiceBackendIdentity(WatchdogService.NAME);

        // callback
        callback();

        // init device watchdog for devices we know if allowed
        if (objectHasOwnProperty_Trueish(process.env, "WATCHDOG_DISABLED_DEVICES")) {
            logger.warn(`Ignoring watchdog setup due to WATCHDOG_DISABLED being set`);
        } else {
            // init device watchdogs
            this.initDeviceWatchdogs();

            // listen for messages when devices post data
            this.eventService!.subscribeTopic(constants.TOPICS.DEVICE, "known.#", this.deviceTopicMessages.bind(this));

            // listen for messages about devices coming and going
            this.eventService!.subscribeTopic(
                constants.TOPICS.CONTROL,
                "device.#",
                this.deviceControlMessages.bind(this)
            );
        }

        // init sensor watchdog for binary sensors
        this.initSensorWatchdogs();

        // listen for messages when sensors post data
        this.eventService!.subscribeTopic(constants.TOPICS.SENSOR, "known.#", this.sensorTopicMessages.bind(this));

        // listen for messages about sensors coming and going
        this.eventService!.subscribeTopic(constants.TOPICS.CONTROL, "sensor.#", this.sensorControlMessages.bind(this));
    }

    /**
     * Return info on device watchdogs
     * @returns
     */
    getAllDevices(): Record<string, WatchdogInfo> {
        const result: Record<string, WatchdogInfo> = {};
        for (const deviceId of _deviceWatchdogs.keys()) {
            const w = _deviceWatchdogs.get(deviceId)!;
            result[deviceId] = {
                id: deviceId,
                left: w.left(),
            } as WatchdogInfo;
        }
        return result;
    }
    /**
     * Return info on sensor watchdogs
     * @returns
     */
    getAllSensors(): Record<string, WatchdogInfo> {
        const result: Record<string, WatchdogInfo> = {};
        for (const sensorId of _sensorWatchdogs.keys()) {
            const w = _sensorWatchdogs.get(sensorId)!;
            result[sensorId] = {
                id: sensorId,
                left: w.left(),
            } as WatchdogInfo;
        }
        return result;
    }

    private async initDeviceWatchdogs() {
        const devices = await this.storageService!.getAllDevices(this.authUser);
        devices.forEach((device) => {
            // create a watchdog per device if active
            if (!device.active) {
                logger.info(
                    `NOT adding watchdog for device with ID <${device.id}> and name <${device.name}> as it's INACTIVE`
                );
            } else {
                logger.info(
                    `Adding watchdog for device with ID <${device.id}> and name <${device.name}> with timeout <${constants.DEFAULTS.WATCHDOG.DEVICES.TIMEOUT}>`
                );
                this.addDeviceWatchdog(device);
            }
        });
    }

    private async initSensorWatchdogs() {
        const sensors = await this.storageService!.getSensors(this.authUser, {
            type: SensorType.binary,
        });
        sensors.forEach((sensor) => {
            // create a watchdog per sensor
            logger.info(
                `Adding watchdog for sensor with ID <${sensor.id}>, name <${sensor.name}> and type <${sensor.type}> with timeout <${constants.DEFAULTS.WATCHDOG.SENSORS.TIMEOUT}>`
            );
            this.addSensorWatchdog(sensor);
        });
    }

    private addDeviceWatchdog(device: Device) {
        let w = new Watchdog(constants.DEFAULTS.WATCHDOG.DEVICES.TIMEOUT as number);

        // listen for resets
        w.on("reset", async (food: WatchdogFood<string, string>) => {
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
                return this.removeDeviceWatchdog(deviceId);
            }

            // feed watchdog
            this.feedDeviceWatchdog(deviceId);

            // publish on topic
            const payload: TopicControlMessage = {
                type: ControlMessageTypes.watchdogReset,
                device: device,
                deviceId: deviceId,
            };
            this.eventService!.publishTopic(constants.TOPICS.CONTROL, "known.device.watchdogReset", payload);
        });

        // add to cache
        _deviceWatchdogs.set(device.id, w);

        // feed watchdog
        this.feedDeviceWatchdog(device.id);
    }

    private addSensorWatchdog(sensor: Sensor) {
        let w = new Watchdog(constants.DEFAULTS.WATCHDOG.SENSORS.TIMEOUT as number);

        // listen for resets
        w.on("reset", async (food: WatchdogFood<string, string>) => {
            // get sensor id
            const sensorId = food.data;

            // log
            logger.info(`Sensor (<${sensorId}>) reset`);

            // fetch sensor from db
            let sensor;
            try {
                sensor = await this.storageService!.getSensor(this.authUser, sensorId);
            } catch (err) {
                // sensor not found / no longer found
                logger.info(`Sensor for watchdog for ID <${sensorId}> not found in database removing`);
                return this.removeSensorWatchdog(sensorId);
            }

            // feed watchdog
            this.feedSensorWatchdog(sensorId);

            // publish on topic
            const payload: TopicControlMessage = {
                type: ControlMessageTypes.watchdogReset,
                device: sensor!.device,
                deviceId: sensor!.deviceId,
                sensor: sensor,
                sensorId: sensorId,
            };
            this.eventService!.publishTopic(constants.TOPICS.CONTROL, "known.sensor.watchdogReset", payload);

            // add sensor reading for binary sensor
            this.storageService!.persistSensorSample(sensor, 0, moment.utc());
        });

        // add to cache
        _sensorWatchdogs.set(sensor.id, w);

        // feed watchdog
        this.feedSensorWatchdog(sensor.id);
    }

    private removeDeviceWatchdog(deviceId: string) {
        const w = _deviceWatchdogs.get(deviceId);
        if (w) {
            w.sleep();
        }
        _deviceWatchdogs.delete(deviceId);
    }

    private removeSensorWatchdog(sensorId: string) {
        const w = _sensorWatchdogs.get(sensorId);
        if (w) {
            w.sleep();
        }
        _sensorWatchdogs.delete(sensorId);
    }

    private async deviceTopicMessages(result: ISubscriptionResult) {
        // get device id
        const msg = result.data as TopicControlMessage;

        // feed watchdog
        this.feedDeviceWatchdog(msg.deviceId);
    }

    private async sensorTopicMessages(result: ISubscriptionResult) {
        // get sensor id
        const msg = result.data as TopicControlMessage;
        if (!msg.sensorId) {
            logger.debug(`No sensor ID in sensor message - ignoring`);
            return;
        }

        // feed watchdog
        this.feedSensorWatchdog(msg.sensorId!);
    }

    private feedDeviceWatchdog(deviceId: string) {
        logger.debug(`Feeding watchdog for deviceId <${deviceId}>`);
        if (_deviceWatchdogs.has(deviceId)) {
            _deviceWatchdogs.get(deviceId)!.feed({
                timeout: constants.DEFAULTS.WATCHDOG.DEVICES.TIMEOUT as number,
                data: deviceId,
            });
            logger.debug(`Fed watchdog for device with id <${deviceId}>`);
        }
    }

    private feedSensorWatchdog(sensorId: string) {
        logger.debug(`Feeding watchdog for sensorId <${sensorId}>`);
        if (_sensorWatchdogs.has(sensorId)) {
            _sensorWatchdogs.get(sensorId)!.feed({
                timeout: constants.DEFAULTS.WATCHDOG.SENSORS.TIMEOUT as number,
                data: sensorId,
            });
            logger.debug(`Fed watchdog for sensor with id <${sensorId}>`);
        }
    }

    private async deviceControlMessages(result: ISubscriptionResult) {
        const parts = result.routingKey!.split(".");
        if (parts[1] === "create") {
            // new device was created
            const deviceId = result.data.new.id;
            if (result.data.new.active) {
                logger.info(`Device with ID <${deviceId}> was created - adding watchdog`);
                this.addDeviceWatchdog(result.data.new as Device);
            } else {
                logger.info(`Device with ID <${deviceId}> was created INACTIVE - NOT adding watchdog`);
            }
        } else if (parts[1] === "update") {
            // device was updated
            const deviceId = result.data.new.id;

            if (result.data.new.active && !result.data.old.active) {
                // device now active - add watchdog
                logger.info(`Device with ID <${deviceId}> was updated - was INACTIVE, now ACTIVE - adding watchdog`);
                this.addDeviceWatchdog(result.data.new as Device);
            } else if (!result.data.new.active && result.data.old.active) {
                logger.info(`Device with ID <${deviceId}> was updated - was ACTIVE, now INACTIVE - removing watchdog`);
                this.removeDeviceWatchdog(deviceId);
            }
        } else if (parts[1] === "delete") {
            // device was deleted
            const deviceId = result.data.old.id;
            logger.info(`Device with ID <${deviceId}> was deleted - removing watchdog`);
            this.removeDeviceWatchdog(deviceId);
        }
    }

    private async sensorControlMessages(result: ISubscriptionResult) {
        const parts = result.routingKey!.split(".");
        if (parts[1] === "create") {
            // new device was created
            const sensorId = result.data.new.id;
            logger.info(`Sensor with ID <${sensorId}> was created - adding watchdog`);
            this.addSensorWatchdog(result.data.new as Sensor);
        } else if (parts[1] === "update") {
            // sensor was updated
            const sensorId = result.data.new.id;
            logger.info(`Sensor with ID <${sensorId}> was updated - nothing to do with watchdog`);
        } else if (parts[1] === "delete") {
            // device was deleted
            const sensorId = result.data.old.id;
            logger.info(`Sensor with ID <${sensorId}> was deleted - removing watchdog`);
            this.removeSensorWatchdog(sensorId);
        }
    }
}
