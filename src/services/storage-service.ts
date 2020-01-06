import * as  util from "util";
import {constants} from "../constants";
import {BaseService, Device, Sensor, House, SensorType, TopicSensorMessage, RedisSensorMessage, TopicDeviceMessage, TopicControlMessage, RedisDeviceMessage, ControlMessageTypes, IngestedSensorMessage, IngestedDeviceMessage, SensorReading, DeviceStatus, IngestedControlMessage, WatchdogNotification} from "../types";
import { EventService } from "./event-service";
import { RedisService } from "./redis-service";
import { LogService } from "./log-service";
import { DatabaseService } from "./database-service";
import { ISubscriptionResult } from "../configure-queues-topics";
import * as utils from "../utils";
import Moment from 'moment';
import moment = require("moment");
import { stringify } from "querystring";

const SENSOR_KEY_PREFIX = 'sensor:';
const DEVICE_KEY_PREFIX = 'device:';

export class StorageService extends BaseService {
    dbService? : DatabaseService;
    logService? : LogService;
    eventService? : EventService;
    redisService? : RedisService;

    constructor() {
        super("storage");
        this.dependencies = ['db', 'log', 'event', "redis"];
    }

    init(callback : (err?:Error) => {}, services : BaseService[]) {
        this.dbService = services[0] as unknown as DatabaseService;
        this.logService = services[1] as unknown as LogService;
        this.eventService = services[2] as unknown as EventService;
        this.redisService = services[3] as unknown as RedisService;

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

    async getDevices() : Promise<Device[]> {
        const result = await this.dbService!.query(`select d.id deviceid, d.name devicename, d.notify "notify", d.muted_until "until", h.id houseid, h.name housename from device d left outer join house h on d.houseid=h.id;`);
        const devices = result.rows.map(row => {
            // get watchdog status
            const until = row.until || undefined;
            const wd : WatchdogNotification = (() => {
                const rowvalue = row.notify;
                if (rowvalue === 0) return WatchdogNotification.no;
                if (rowvalue === 2) {
                    if (!until) {
                        this.logService!.warn(`Notify status for device set to muted but no until date/time - treating as 1`);
                    } else {
                        return WatchdogNotification.muted;
                    }
                }
                if (rowvalue !== 1) {
                    this.logService!.error(`Read unknown value for notify from db (${rowvalue}) - treating as 1`);
                }
                return WatchdogNotification.yes;
            })();

            return {
                "id": row.deviceid,
                "name": row.devicename,
                "notify": wd,
                "mutedUntil": until,
                "house": {
                    "id": row.houseid,
                    "name": row.housename
                }
            }
        }) as Device[];
        return devices;
    }

    getDeviceIds() : Promise<string[]> {
        return this.getDevices().then(devices => {
            const deviceIds = devices.map(device => device.id) as string[];
            return Promise.resolve(deviceIds);
        })
    }

    getDeviceById(deviceId : string) : Promise<Device> {
        return this.getDevices().then(devices => {
            const filtered = devices.filter(device => device.id === deviceId);
            if (filtered.length === 1) return Promise.resolve(filtered[0]);
            return Promise.reject(Error(`Unable to find a single device with id <${deviceId}>`));
        })
    }

    getDevicesByIds(deviceIds : string[]) : Promise<Device[]> {
        // get all devices
        return this.getDevices().then(devices => {
            // filter them
            const filtered = devices.reduce((prev, device) => {
                if (deviceIds.includes(device.id)) prev.push(device);
                return prev;
            }, [] as Device[]);

            // resolve promise
            return Promise.resolve  (filtered);
        })
    }

    /**
     * Returns a map mapping the supplied ids to devices if we know the device or 
     * undefined otherwise.
     * 
     * @param sensorIds 
     */
    getDeviceMapByIds(deviceIds : string[]) : Promise<Map<string,Device|undefined>> {
        return this.getDevicesByIds(deviceIds).then(devices => {
            const result = devices.reduce((prev, device) => {
                prev.set(device.id, device);
                return prev;
            }, new Map<string,Device|undefined>());
            
            deviceIds.filter(id => !result.has(id)).forEach(id => result.set(id, undefined));
            return Promise.resolve(result);
        })
    }

    /**
     * Returns the known devices we have recently heard from i.e. that has a value in 
     * Redis.
     */
    getKnownDevicesStatus() : Promise<DeviceStatus[]> {
        return this.getDevicesStatuses(true);
    }

    /**
     * Returns the unknown devices we have recently heard from i.e. that has a value in 
     * Redis.
     */
    getUnknownDevicesStatus() : Promise<DeviceStatus[]> {
        return this.getDevicesStatuses(false);
    }

    /**
     * Returns the known sensors we have recently heard from i.e. that has a value in 
     * Redis.
     */
    getKnownSensorsWithRecentReadings() : Promise<SensorReading[]> {
        return this.getSensorsWithRecentReadings(true);
    }

    /**
     * Returns the unknown sensors we have recently heard from i.e. that has a value in 
     * Redis.
     */
    getUnknownSensorsWithRecentReadings() : Promise<SensorReading[]> {
        return this.getSensorsWithRecentReadings(false);
    }

    /**
     * Get the sensor reading from Redis from the supplied sensor ids.
     * 
     * @param sensorIds 
     */
    getRecentReadingBySensorIds(sensorIds : string[]) : Promise<Map<string,RedisSensorMessage>> {
        if (!sensorIds || !sensorIds.length) return Promise.reject(Error(`No sensor ids supplied`));
        const redisKeys = sensorIds.map(id => `${SENSOR_KEY_PREFIX}${id}`);
        return this.redisService!.mget(...redisKeys).then((data : string[]) => {
            const result = data.reduce((prev, str_redis) => {
                if (!str_redis) return prev;
                try {
                    const redis_obj = JSON.parse(str_redis) as RedisSensorMessage;
                    prev.set(redis_obj.id, redis_obj);
                } catch (err) {
                    this.logService!.warn(`Unable to parse sensor message from Redis <${str_redis}>, error message: ${err.message}`);
                }
                return prev;
            }, new Map<string,RedisSensorMessage>());
            return Promise.resolve(result);
        })
    }

    getSensors() : Promise<Sensor[]> {
        return this.dbService!.query("select s.id sensorid, s.name sensorname, s.type sensortype, s.label sensorlabel, d.id deviceid, d.name devicename, h.id houseid, h.name housename from sensor s join device d on s.deviceid=d.id left outer join house h on d.houseid=h.id").then(result => {
            const sensors = result.rows.map(row => {
                return {
                    "id": row.sensorid,
                    "name": row.sensorname,
                    "label": row.sensorlabel,
                    "type": row.sensortype === "temp" ? SensorType.temp : row.sensortype === "hum" ? SensorType.hum : null,
                    "device": {
                        "id": row.deviceid,
                        "name": row.devicename,
                        "house": {
                            "id": row.houseid,
                            "name": row.housename
                        }
                    }
                } as Sensor;
            })
            return Promise.resolve(sensors);
        })
    }

    /**
     * Return the ids of the sensors we know of.
     * 
     */
    getSensorIds() : Promise<string[]> {
        return this.getSensors().then(sensors => {
            return Promise.resolve(sensors.map(sensor => sensor.id));
        })
    }

    /**
     * Returns a map mapping the supplied ids to sensors if we know the sensor or 
     * undefined otherwise.
     * 
     * @param sensorIds 
     */
    getSensorMapByIds(sensorIds : string[]) : Promise<Map<string,Sensor|undefined>> {
        return this.getSensorsByIds(sensorIds).then(sensors => {
            const result = sensors.reduce((prev, sensor) => {
                prev.set(sensor.id, sensor);
                return prev;
            }, new Map<string,Sensor|undefined>());
            
            sensorIds.filter(id => !result.has(id)).forEach(id => result.set(id, undefined));
            return Promise.resolve(result);
        })
    }

    /**
     * Returns the sensors with the supplied ids. If a sensor isn't known it is 
     * simply not returned.
     * 
     * @param sensorIds 
     */
    getSensorsByIds(sensorIds : string[]) : Promise<Sensor[]> {
        // get all sensors
        return this.getSensors().then(sensors => {
            // filter them
            const filtered = sensors.filter(sensor => sensorIds.includes(sensor.id));
            
            // resolve promise
            return Promise.resolve(filtered);
        })
    }

    /**
     * Return a single sensor by id.
     * 
     * @param sensorId 
     */
    getSensorById(sensorId : string) : Promise<Sensor> {
        return this.getSensors().then(sensors => {
            const filtered = sensors.filter(sensor => sensor.id === sensorId);
            if (filtered.length != 1) {
                return Promise.reject(Error(`Unable to find a single sensor with id <${sensorId}>`));
            } else {
                return Promise.resolve(filtered[0]);
            }
        })
    }

    /**
     * Given one or more sensor ID's will return the device ID for those sensors or an error 
     * if the sensor ID's are from multiple devices.
     * 
     * @param sensorIds list of sensor ids to look up
     */
    getDeviceIdForSensorIds(...sensorIds : Array<string>) : Promise<string> {
        return this.dbService!.query("select deviceid from sensor where id = any($1::varchar[])", [sensorIds]).then(result => {
            const deviceIds = result.rows.reduce((prev, row) : Set<string> => {
                prev.add(row.deviceid);
                return prev;
            }, new Set<String>());
            if (deviceIds.size() !== 1) {
                return Promise.reject(Error(``))
            } else {
                return Promise.resolve(deviceIds[0]);
            }
        })
    }

    /**
     * Insert the supplied reading for the supplied sensor id.
     * 
     * @param id 
     * @param value 
     */
    private persistSensorReading(id : string, value : number) : Promise<void> {
        return this.dbService!.query("insert into sensor_data (dt, id, value) values (current_timestamp, $1, $2)", id, value).then(result => {
            return Promise.resolve();
        })
    }

    /**
     * Listen for messages on the sensor topic and keep last event data around for each sensor.
     */
    private addListenerToSensorTopic() {
        this.eventService!.subscribeTopic(constants.TOPICS.SENSOR, "#", (result : ISubscriptionResult) => {
            const data = result.data as TopicSensorMessage;
            this.logService!.debug(`Storage service received message on ${result.exchangeName} / ${result.routingKey} for sensor id <${data.sensorId}> value <${data.value}>`);

            // get sensor from redis if it's there already
            this.redisService!.get(`${SENSOR_KEY_PREFIX}${data.sensorId}`).then(str_sensor => {
                let redis_sensor : RedisSensorMessage;
                if (!str_sensor) {
                    // didn't find sensor in redis - create
                    redis_sensor = {
                        "id": data.sensorId,
                        "dt": new Date(),
                        "value": data.value
                    }
                } else {
                    // parse string from sensor
                    redis_sensor = JSON.parse(str_sensor);
                    redis_sensor.dt = new Date();
                    redis_sensor.value = data.value;
                }

                // set sensor in Redis
                this.logService!.debug(`Adding sensor with key <${SENSOR_KEY_PREFIX}${data.sensorId}> to Redis`);
                this.redisService!.setex(`${SENSOR_KEY_PREFIX}${data.sensorId}`, constants.DEFAULTS.REDIS.SENSOR_EXPIRATION, JSON.stringify(redis_sensor));
            })
            
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
            
            // see if we know the sensor
            this.getSensorById(msg.id).then(sensor => {
                // known sensor - persist reading
                return this.persistSensorReading(sensor.id, msg.value).then(() => {
                    // mark msg as consumed
                    result.callback();

                    // return promise
                    return Promise.resolve(sensor);
                });

            }).catch(err => {
                // unknown sensor - mark msg as consumed and return promise
                result.callback();
                return Promise.resolve(null);

            }).then(sensor => {
                // create an augmented sensor reading and post to topic
                const payload = {
                    "value": msg.value,
                    "sensorId": msg.id,
                    "sensor": sensor
                } as TopicSensorMessage;

                // publish
                this.eventService!.publishTopic(constants.TOPICS.SENSOR, sensor ? "known" : "unknown", payload);

            })
        });
    }

    private addListenerToControlQueue() {
        this.eventService!.subscribeQueue(constants.QUEUES.CONTROL, (result) => {
            // cast
            const msg = result.data as IngestedControlMessage;

            // see if we know the device
            this.getDeviceById(msg.id).catch(err => {
                return Promise.resolve(null);

            }).then((device : Device | null) => {
                // mark msg as consumed
                result.callback();

                // created augmented message
                const payload = {
                    "deviceId": msg.id,
                    "device": device,
                    "type": msg.type
                } as TopicControlMessage;

                // publish
                this.eventService!.publishTopic(constants.TOPICS.CONTROL, device ? `known.${msg.type}` : `unknown/${msg.type}`, payload);
            })
        });
    }

    private addListenerToDeviceQueue() {
        this.eventService!.subscribeQueue(constants.QUEUES.DEVICE, (result) => {
            // cast
            const msg = result.data as IngestedDeviceMessage;

            // see if we know the device
            this.getDeviceById(msg.id).catch(err => {
                return Promise.resolve(null);

            }).then((device : Device | null) => {
                // mark msg as consumed
                result.callback();
                
                // create augmented device and post to topic
                const payload = {
                    "deviceId": msg.id,
                    "device": device
                } as TopicDeviceMessage;

                // publish
                this.eventService!.publishTopic(constants.TOPICS.DEVICE, device ? "known" : "unknown", payload);
            })
        })
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
        this.eventService!.subscribeTopic(constants.TOPICS.CONTROL, "#", (result : ISubscriptionResult) => {
            const data = result.data as TopicControlMessage;
            this.getOrCreateRedisDeviceMessage(data.deviceId, (redis_device) => {
                // act on event
                if (result.routingKey === ControlMessageTypes.restart) {
                    redis_device.restarts++;
                } else if (result.routingKey === ControlMessageTypes.watchdogReset) {
                    redis_device.watchdogResets++;
                }
            });
        })
    }

    /**
     * Gets or creates a message in Redis for the supplied device id and sets the 
     * current timestamp on the message. Optionally calls a callback to enrich the 
     * message in redis further.
     * 
     * @param deviceId 
     * @param callback 
     */
    private getOrCreateRedisDeviceMessage(deviceId : string, callback? : (redis_device : RedisDeviceMessage) => void) : Promise<void> {
        // query redis
        return this.redisService!.get(`${DEVICE_KEY_PREFIX}${deviceId}`).then(str_device => {
            // see if device is already in redis or create if not
            let redis_device : RedisDeviceMessage;
            if (!str_device) {
                redis_device = {
                    "id": deviceId,
                    "dt": new Date(),
                    "restarts": 0,
                    "watchdogResets": 0
                }
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
        }).then(() => {
            return Promise.resolve();
        })
    }

    private getSensorsWithRecentReadings(known : boolean) : Promise<SensorReading[]> {
        return this.redisService!.keys(`${SENSOR_KEY_PREFIX}*`).then(keys => {
            this.logService!.debug(`Asked for keys based on pattern <${SENSOR_KEY_PREFIX}*> returned keys <${keys}>`);
            if (!keys || !keys.length) return Promise.resolve([]);
            return this.redisService!.mget(...keys);
        }).then(values => {
            // parse values from Redis
            const sensorIdObjMap = values.reduce((prev, value) => {
                try {
                    const obj = JSON.parse(value) as RedisSensorMessage;
                    prev.set(obj.id, obj);
                } catch (err) {
                    this.logService!.debug(`Unable to parse data from Redis (${value})`);
                }
                return prev;
            }, new Map<string,RedisSensorMessage>());
            this.logService!.debug(`Created sensor id / sensor redis map with keys: <${Array.from(sensorIdObjMap.keys())}>`);

            // get the sensors we need (known are sensors in db and otherwise the ones 
            // we cannot find in the db)
            const sensorMapPromise = this.getSensorMapByIds(Array.from(sensorIdObjMap.keys()));
            return Promise.all([Promise.resolve(sensorIdObjMap), sensorMapPromise]);

        }).then(values => {
            const sensorIdObjMap = values[0] as Map<string,RedisSensorMessage>;
            const sensorMap = values[1] as Map<string,Sensor>;
            this.logService!.debug(`Retrieved sensors from database based on sensor data from Redis`);
            
            const resultArray : Array<SensorReading> = [];
            sensorMap.forEach((sensor, sensorId) => {
                if ((known && sensor) || (!known && !sensor)) {
                    const redisObj = sensorIdObjMap.get(sensorId);
                    // @ts-ignore
                    let m = redisObj && redisObj.dt ? Moment(redisObj.dt) : null;
                    // @ts-ignore
                    let denominator = sensor ? constants.SENSOR_DENOMINATORS[sensor.type] : "??";
                    const result = {
                        "device": sensor ? sensor.device : undefined,
                        "id": sensorId,
                        "label": sensor ? sensor.label : undefined,
                        "name": sensor ? sensor.name : undefined,
                        "type": sensor ? sensor.type : undefined,
                        "value": redisObj ? redisObj!.value : null,
                        "value_string": redisObj ? `${redisObj.value.toFixed(2)}${denominator}` : null,
                        "dt": redisObj ? redisObj.dt : null,
                        "dt_string": redisObj && redisObj.dt ? utils.formatDate(redisObj!.dt) : null,
                        "ageMinutes": m ? Moment().diff(m, 'minutes') : -1,
                        "denominator": denominator
                    } as SensorReading;
                    resultArray.push(result);
                }
            })
            return Promise.resolve(resultArray);
        })
    }

    private getDevicesStatuses(known : boolean) : Promise<DeviceStatus[]> {
        return this.redisService!.keys(`${DEVICE_KEY_PREFIX}*`).then(keys => {
            this.logService!.debug(`Asked for keys based on pattern <${DEVICE_KEY_PREFIX}*> returned keys <${keys}>`);
            if (!keys || !keys.length) return Promise.resolve([]);
            return this.redisService!.mget(...keys);
        }).then(values => {
            // parse values from Redis
            const deviceIdObjMap = values.reduce((prev, value) => {
                try {
                    const obj = JSON.parse(value) as RedisDeviceMessage;
                    prev.set(obj.id, obj);
                } catch (err) {
                    this.logService!.debug(`Unable to parse data from Redis (${value})`);
                }
                return prev;
            }, new Map<string,RedisDeviceMessage>());
            this.logService!.debug(`Created device id / device redis map with keys: <${Array.from(deviceIdObjMap.keys())}>`);

            // get the devices we need (known are devices in db and otherwise the ones 
            // we cannot find in the db)
            const deviceMapPromise = this.getDeviceMapByIds(Array.from(deviceIdObjMap.keys()));
            return Promise.all([Promise.resolve(deviceIdObjMap), deviceMapPromise]);

        }).then(values => {
            const deviceIdObjMap = values[0] as Map<string,RedisDeviceMessage>;
            const deviceMap = values[1] as Map<string,Device>;
            this.logService!.debug(`Retrieved devices from database based on device data from Redis`);
            
            const resultArray : Array<DeviceStatus> = [];
            deviceMap.forEach((device, deviceId) => {
                if ((known && device) || (!known && !device)) {
                    const redisObj = deviceIdObjMap.get(deviceId);
                    let m = redisObj && redisObj.dt ? moment(redisObj.dt) : null;
                    const result = {
                        "id": deviceId,
                        "name": device ? device.name : undefined,
                        "notify": device.notify,
                        "mutedUntil": device.mutedUntil,
                        "house": device ? device.house : undefined,
                        "dt": redisObj ? redisObj.dt : null,
                        "watchdogResets": redisObj ? redisObj.watchdogResets : undefined,
                        "restarts": redisObj ? redisObj.restarts : undefined,
                        "ageMinutes": m ? Moment().diff(m, 'minutes') : -1
                    } as DeviceStatus;
                    resultArray.push(result);
                }
            })
            return Promise.resolve(resultArray);
        })
    }
}
