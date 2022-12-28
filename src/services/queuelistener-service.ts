import constants from "../constants";
import { EventService } from "./event-service";
import { RedisService } from "./redis-service";
import { Logger } from "../logger";
import { DatabaseService } from "./database-service";
import {BaseService, Device, Sensor, TopicSensorMessage, RedisSensorMessage, 
    TopicDeviceMessage, TopicControlMessage, ControlMessageTypes, 
    IngestedSensorMessage, IngestedDeviceMessage, IngestedControlMessage, 
    RedisDeviceMessage, 
    BackendIdentity,
    SensorType} from "../types";
import { ISubscriptionResult } from "../configure-queues-topics";
import moment, {Moment} from "moment";
import { IdentityService } from "./identity-service";
import { StorageService } from "./storage-service";

const SENSOR_KEY_PREFIX = 'sensor:';
const DEVICE_KEY_PREFIX = 'device:';

const logger = new Logger("queuelistener-service");

/**
 * Service listening on queues to perform persistance etc.
 * 
 */
export class QueueListenerService extends BaseService {
    public static NAME = "queuelistener";

    dbService?: DatabaseService;
    eventService?: EventService;
    redisService?: RedisService;
    storage: StorageService;
    security: IdentityService;
    authUser: BackendIdentity;

    constructor() {
        super(QueueListenerService.NAME);
        this.dependencies = [
            DatabaseService.NAME,
            EventService.NAME,
            RedisService.NAME,
            StorageService.NAME,
            IdentityService.NAME,
        ];
    }

    async init(callback: (err?: Error) => {}, services: BaseService[]) {
        this.dbService = services[0] as unknown as DatabaseService;
        this.eventService = services[1] as unknown as EventService;
        this.redisService = services[2] as unknown as RedisService;
        this.storage = services[3] as StorageService;
        this.security = services[4] as IdentityService;

        // get auth user for service
        this.authUser = await this.security.getServiceBackendIdentity(QueueListenerService.NAME);

        // listen to device queue to persist and augment device reading
        this.addListenerToDeviceQueue();

        // listen to sensor queue to persist and augment sensor reading
        this.addListenerToSensorQueue();

        // listen to control queue
        this.addListenerToControlQueue();

        // listen to sensor topic
        this.addListenerToSensorTopic();

        // listen to control topic
        this.addListenerToControlTopic();

        // listen to device topic
        this.addListenerToDeviceTopic();

        // did init
        callback();
    }

    /**
     * Returns the RedisSensorMessage from Redis for the supplied sensor ID's. Values
     * are returned in the same order as supplied sensor ID(s). Values may be undefined
     * if data for a sensor is not found in Redis.
     *
     * @param sensorIds
     */
    async getRedisSensorMessage(...sensorIds: string[]): Promise<RedisSensorMessage[]> {
        if (!sensorIds || sensorIds.length === 0) return [];
        const redisKeys = sensorIds.map((id) => `${SENSOR_KEY_PREFIX}${id}`);
        const redisData = await this.redisService!.mget(...redisKeys);
        return redisData.map((d) => (d ? JSON.parse(d) : undefined));
    }

    /**
     * Returns the RedisDeviceMessage from Redis for the supplied device ID's. Values
     * are returned in the same order as supplied device ID(s). Values may be undefined
     * if data for a device is not found in Redis.
     *
     * @param deviceIds
     */
    async getRedisDeviceMessage(...deviceIds: string[]): Promise<RedisDeviceMessage[]> {
        if (!deviceIds || deviceIds.length === 0) return [];
        const redisKeys = deviceIds.map((id) => `${DEVICE_KEY_PREFIX}${id}`);
        const redisData = await this.redisService!.mget(...redisKeys);
        return redisData.map((d) => (d ? JSON.parse(d) : undefined));
    }

    /**
     * Listen for messages on the sensor topic and keep last event data around for each sensor.
     */
    private addListenerToSensorTopic() {
        this.eventService!.subscribeTopic(constants.TOPICS.SENSOR, "#", (result: ISubscriptionResult) => {
            const data = result.data as TopicSensorMessage;
            logger.debug(
                `Received message on ${result.exchangeName} / ${result.routingKey} for sensor id <${data.sensorId}> value <${data.value}>`
            );

            // set sensor in redis
            const redis_sensor = {
                deviceId: data.deviceId,
                id: data.sensorId,
                dt: new Date(),
                value: data.value,
            } as RedisSensorMessage;
            logger.debug(
                `Setting sensor with key <${SENSOR_KEY_PREFIX}${data.sensorId}> (device <${data.deviceId}>) in Redis`
            );
            this.redisService!.setex(
                `${SENSOR_KEY_PREFIX}${data.sensorId}`,
                constants.DEFAULTS.REDIS.SENSOR_EXPIRATION_SECS,
                JSON.stringify(redis_sensor)
            );
        });
    }

    /**
     * Listen for messages on the sensor queue and do as follows:
     * 1. Is the sensor known?
     * 2. If yes: Persist sensor reading
     * 3. If yes and no: Create augmented sensor reading object and post to sensor topic
     */
    private addListenerToSensorQueue() {
        this.eventService!.subscribeQueue(constants.QUEUES.SENSOR, (result) => {
            // cast
            const msg = result.data as IngestedSensorMessage;
            let persistValue = msg.value;

            // see if we know the sensor
            this.storage
                .getSensor(this.authUser, msg.id)
                .then((sensor) => {
                    // known sensor - persist reading (with dt if supplied)
                    let dt: Moment | undefined;
                    if (msg.dt) {
                        dt = moment.utc(msg.dt);
                    } else {
                        dt = moment.utc();
                    }
                    let from_dt: Moment | undefined;
                    if (msg.duration) {
                        from_dt = moment(dt).subtract(msg.duration, "second");
                    }

                    // clamp value if binary sensor
                    if (sensor.type === SensorType.binary) {
                        if (msg.value === 0) {
                            persistValue = 0;
                        } else {
                            persistValue = 1;
                        }
                    }
                    return this.storage!.persistSensorSample(sensor, persistValue, dt, from_dt).then(() => {
                        // mark msg as consumed
                        result.callback();

                        // return promise
                        return Promise.all([sensor, sensor.device]);
                    });
                })
                .catch(() => {
                    // unknown sensor - mark msg as consumed and return promise
                    result.callback();
                    return Promise.all([
                        Promise.resolve(undefined),
                        this.storage.getDevice(this.authUser, msg.deviceId),
                    ]);
                })
                .then((data: any) => {
                    const sensor: Sensor | undefined = data[0];
                    const device = data[1] as Device;

                    // create an augmented sensor reading and post to topic
                    const payload = {
                        deviceId: device.id,
                        value: persistValue,
                        sensorId: msg.id,
                    } as TopicSensorMessage;

                    // publish
                    this.eventService!.publishTopic(
                        constants.TOPICS.SENSOR,
                        sensor ? `known.${msg.id}` : `unknown.${msg.id}`,
                        payload
                    ).then(() => {
                        logger.debug(`Posted augmented sensor message to ${constants.TOPICS.SENSOR}`);
                    });
                });
        });
    }

    private addListenerToControlQueue() {
        this.eventService!.subscribeQueue(constants.QUEUES.CONTROL, (result) => {
            // cast
            const msg = result.data as IngestedControlMessage;

            // see if we know the device
            this.storage
                .getDevice(this.authUser, msg.id)
                .catch(() => {
                    return Promise.resolve(null);
                })
                .then((device: Device | null) => {
                    // mark msg as consumed
                    result.callback();

                    // created augmented message
                    const payload = {
                        deviceId: msg.id,
                        device: device,
                        type: msg.type,
                    } as TopicControlMessage;

                    // publish
                    this.eventService!.publishTopic(
                        constants.TOPICS.CONTROL,
                        device ? `known.${msg.target}.${msg.type}` : `unknown.${msg.target}.${msg.type}`,
                        payload
                    );
                });
        });
    }

    private addListenerToDeviceQueue() {
        this.eventService!.subscribeQueue(constants.QUEUES.DEVICE, (result) => {
            // cast
            const msg = result.data as IngestedDeviceMessage;
            logger.debug(
                `Received message on <${constants.QUEUES.DEVICE}> with data <${msg}>`
            );

            // see if we know the device
            this.storage
                .getDevice(this.authUser, msg.id)
                .catch(() => {
                    return Promise.resolve(null);
                })
                .then((device: Device | null) => {
                    // mark msg as consumed
                    result.callback();

                    // create augmented device and post to topic
                    const payload = {
                        deviceId: msg.id,
                        device: device,
                    } as TopicDeviceMessage;

                    // update last ping
                    if (device) {
                        logger.debug(`Received message on <${constants.QUEUES.DEVICE}> and we know the device <${device.id}> - update last device ping`);
                        this.updateDeviceLastPing(device.id);
                    }

                    // if any device data update redis
                    if (device && msg.deviceData) {
                        logger.debug(`Received message on <${constants.QUEUES.DEVICE}> and we know the device <${device.id}> and there is deviceData - update data in Redis`);
                        this.storage!.setDeviceData(device.id, msg.deviceData);
                    }

                    // publish
                    this.eventService!.publishTopic(constants.TOPICS.DEVICE, device ? "known" : "unknown", payload);
                });
        });
    }

    /**
     * Listen for messages on the device topic to ensure data in redis.
     *
     */
    private addListenerToDeviceTopic() {
        this.eventService!.subscribeTopic(constants.TOPICS.DEVICE, "#", (result) => {
            // cast
            const data = result.data as TopicDeviceMessage;

            // call method to create / update device in redis
            this.getOrCreateRedisDeviceMessage(data.deviceId);
        });
    }

    /**
     * Listen for messages on the control topic and increment counters in redis.
     *
     */
    private addListenerToControlTopic() {
        this.eventService!.subscribeTopic(constants.TOPICS.CONTROL, "#", (result: ISubscriptionResult) => {
            const data = result.data as TopicControlMessage;
            this.getOrCreateRedisDeviceMessage(data.deviceId, (redis_device) => {
                // act on event
                if (!result.routingKey) {
                    logger.debug("Ignoring control topic message as no routing key");
                } else if (result.routingKey?.indexOf(`.${ControlMessageTypes.restart}`) > 0) {
                    if (data.device) this.updateDeviceLastRestart(data.device.id);
                    redis_device.restarts++;
                } else if (result.routingKey?.indexOf(`.${ControlMessageTypes.timeout}`) > 0) {
                    //if (data.device) this.updateDeviceLastWatchdogReset(data.device.id);
                    redis_device.timeouts++;
                }
            });
        });
    }

    /**
     * Gets or creates a message in Redis for the supplied device id and sets the
     * current timestamp on the message. Optionally calls a callback to enrich the
     * message in redis further.
     *
     * @param deviceId
     * @param callback
     */
    private getOrCreateRedisDeviceMessage(
        deviceId: string,
        callback?: (redis_device: RedisDeviceMessage) => void
    ): Promise<void> {
        // query redis
        return this.redisService!.get(`${DEVICE_KEY_PREFIX}${deviceId}`)
            .then((str_device) => {
                // see if device is already in redis or create if not
                let redis_device: RedisDeviceMessage;
                if (!str_device) {
                    redis_device = {
                        id: deviceId,
                        dt: new Date(),
                        restarts: 0,
                        timeouts: 0,
                    };
                } else {
                    // parse extracted json and reinit date
                    redis_device = JSON.parse(str_device) as RedisDeviceMessage;
                }

                // call callback if supplied
                if (callback) callback(redis_device);

                // update timestamp
                redis_device.dt = new Date();

                // (re)store in redis
                return this.redisService!.set(`${DEVICE_KEY_PREFIX}${deviceId}`, JSON.stringify(redis_device));
            })
            .then(() => {
                return Promise.resolve();
            });
    }

    /**
     * Update the last ping for the device with the supplied ID
     * @param deviceId
     */
    private async updateDeviceLastPing(deviceId: string) {
        this.dbService!.query("update device set last_ping=current_timestamp where id=$1", deviceId)
            .then(() => {
                logger.debug(`Updated device last ping timestamp for device with ID <${deviceId}>`);
            })
            .catch((err) => {
                logger.warn(
                    `Caught error while trying to update device last ping timestamp for device with ID <${deviceId}>`,
                    err
                );
            });
    }

    /**
     * Update the last restart for the device with the supplied ID.
     * @param deviceId
     */
    private async updateDeviceLastRestart(deviceId: string) {
        this.dbService!.query("update device set last_restart=current_timestamp where id=$1", deviceId)
            .then(() => {
                logger.debug(`Updated device last restart timestamp for device with ID <${deviceId}>`);
            })
            .catch((err) => {
                logger.warn(
                    `Caught error while trying to update device last restart timestamp for device with ID <${deviceId}>`,
                    err
                );
            });
    }
}