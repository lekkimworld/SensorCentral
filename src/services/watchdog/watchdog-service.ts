import constants from "../../constants";
import { Logger } from "../../logger";
import { BackendIdentity, BaseService, ControlMessageTypes, Device, InitCallback, Sensor, TopicControlMessage, TopicSensorMessage } from "../../types";
import { PromisifiedSemaphore } from "../../utils";
import { PubsubService, TopicMessage } from "../pubsub-service";
import { IdentityService } from "../identity-service";
import { StorageService } from "../storage-service";
import { WatchdogTimer } from "./watchdog-types";

const logger = new Logger("watchdog-service");

export class WatchdogService extends BaseService {
    public static NAME = "watchdog";
    private storage!: StorageService;
    private pubsub!: PubsubService;
    private serviceUser!: BackendIdentity;
    private timers = new Map<string, WatchdogTimer>();
    private timersSem = new PromisifiedSemaphore(1);

    constructor() {
        super(WatchdogService.NAME);
        this.dependencies = [StorageService.NAME, IdentityService.NAME, PubsubService.NAME];
    }

    async init(callback: InitCallback, services: BaseService[]) {
        this.storage = services[0] as StorageService;
        const identity = services[1] as IdentityService;
        this.serviceUser = identity.getServiceBackendIdentity(WatchdogService.NAME);
        this.pubsub = services[2] as PubsubService;

        // load sensors and devices with timeouts
        await this.initWatchdogs();

        // listen for sensor data to feed watchdogs
        this.pubsub.subscribe(`${constants.TOPICS.SENSOR}.known.*`, this.sensorTopicMessages.bind(this));

        // listen for sensor/device lifecycle changes
        this.pubsub.subscribe(`${constants.TOPICS.CONTROL}.*`, this.controlMessages.bind(this));

        logger.info(`Initialized watchdog-service with ${this.timers.size} watchdog(s)`);
        callback();
    }

    private async initWatchdogs() {
        const sensors = await this.storage.getSensorsWithTimeout(this.serviceUser);
        for (const sensor of sensors) {
            this.createTimer(sensor, sensor.timeoutSeconds! * 1000);
        }

        const devices = await this.storage.getDevicesWithTimeout(this.serviceUser);
        for (const device of devices) {
            this.createTimer(device, device.timeoutSeconds! * 1000);
        }
    }

    private createTimer(target: Sensor | Device, timeoutMs: number) {
        const timer = new WatchdogTimer(target, timeoutMs);
        this.timers.set(target.id, timer);
        timer.start((t) => this.onTimeout(t));
        logger.info(`Created watchdog for ${timer.isSensor() ? "sensor" : "device"} <${target.id}> with timeout ${timeoutMs}ms`);
    }

    private async onTimeout(timer: WatchdogTimer) {
        if (timer.isSensor()) {
            const sensor = timer.target as Sensor;
            logger.info(`Sensor timeout: id <${sensor.id}> name <${sensor.name}>`);
            const payload: TopicControlMessage = {
                type: ControlMessageTypes.timeout,
                device: sensor.device,
                deviceId: sensor.deviceId,
                sensor: sensor,
                sensorId: sensor.id,
            };
            this.pubsub.publish(`${constants.TOPICS.CONTROL}.known.sensor.${ControlMessageTypes.timeout}`, payload);
        } else {
            const device = timer.target as Device;
            logger.info(`Device timeout: id <${device.id}> name <${device.name}>`);
            const payload: TopicControlMessage = {
                type: ControlMessageTypes.timeout,
                device: device,
                deviceId: device.id,
            };
            this.pubsub.publish(`${constants.TOPICS.CONTROL}.known.device.${ControlMessageTypes.timeout}`, payload);
        }
    }

    private async sensorTopicMessages(result: TopicMessage) {
        const msg = result.data as TopicSensorMessage;
        try {
            await this.timersSem.take();
            const timer = this.timers.get(msg.sensorId);
            if (timer) {
                timer.feed();
            }
            this.timersSem.leave();
        } catch (err) {
            this.timersSem.leave();
        }
    }

    private async controlMessages(result: TopicMessage) {
        if (result.channel.startsWith(`${constants.TOPICS.CONTROL}.sensor.`)) {
            return this.sensorControlMessages(result);
        }
        if (result.channel.startsWith(`${constants.TOPICS.CONTROL}.device.`)) {
            return this.deviceControlMessages(result);
        }
    }

    private async sensorControlMessages(result: TopicMessage) {
        const parts = result.channel.split(".");
        const action = parts[2];

        if (action === "create") {
            const sensor = result.data.new as Sensor;
            if (sensor.timeoutSeconds) {
                this.createTimer(sensor, sensor.timeoutSeconds * 1000);
            }
        } else if (action === "update") {
            const sensor = result.data.new as Sensor;
            const oldTimer = this.timers.get(sensor.id);

            if (oldTimer && !sensor.timeoutSeconds) {
                oldTimer.stop();
                this.timers.delete(sensor.id);
                logger.info(`Removed watchdog for sensor <${sensor.id}>`);
            } else if (oldTimer && sensor.timeoutSeconds && oldTimer.timeoutMs !== sensor.timeoutSeconds * 1000) {
                oldTimer.stop();
                this.timers.delete(sensor.id);
                this.createTimer(sensor, sensor.timeoutSeconds * 1000);
            } else if (!oldTimer && sensor.timeoutSeconds) {
                this.createTimer(sensor, sensor.timeoutSeconds * 1000);
            } else if (oldTimer) {
                oldTimer.target = sensor;
            }
        } else if (action === "delete") {
            const sensorId = result.data.old.id;
            const timer = this.timers.get(sensorId);
            if (timer) {
                timer.stop();
                this.timers.delete(sensorId);
                logger.info(`Removed watchdog for deleted sensor <${sensorId}>`);
            }
        }
    }

    private async deviceControlMessages(result: TopicMessage) {
        const parts = result.channel.split(".");
        const action = parts[2];

        if (action === "create") {
            const device = result.data.new as Device;
            if (device.timeoutSeconds) {
                this.createTimer(device, device.timeoutSeconds * 1000);
            }
        } else if (action === "update") {
            const device = result.data.new as Device;
            const oldTimer = this.timers.get(device.id);

            if (oldTimer && !device.timeoutSeconds) {
                oldTimer.stop();
                this.timers.delete(device.id);
                logger.info(`Removed watchdog for device <${device.id}>`);
            } else if (oldTimer && device.timeoutSeconds && oldTimer.timeoutMs !== device.timeoutSeconds * 1000) {
                oldTimer.stop();
                this.timers.delete(device.id);
                this.createTimer(device, device.timeoutSeconds * 1000);
            } else if (!oldTimer && device.timeoutSeconds) {
                this.createTimer(device, device.timeoutSeconds * 1000);
            } else if (oldTimer) {
                oldTimer.target = device;
            }
        } else if (action === "delete") {
            const deviceId = result.data.old.id;
            const timer = this.timers.get(deviceId);
            if (timer) {
                timer.stop();
                this.timers.delete(deviceId);
                logger.info(`Removed watchdog for deleted device <${deviceId}>`);
            }
        }
    }
}
