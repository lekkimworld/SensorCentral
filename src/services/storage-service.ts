import * as  util from "util";
import {constants} from "../constants";
import {BaseService, Device, Sensor, House, SensorType, TopicSensorMessage, RedisSensorMessage, TopicDeviceMessage, TopicControlMessage, RedisDeviceMessage, ControlMessageTypes, IngestedSensorMessage, IngestedDeviceMessage, SensorReading, DeviceStatus, IngestedControlMessage, WatchdogNotification, SensorSample} from "../types";
import { EventService } from "./event-service";
import { RedisService } from "./redis-service";
import { LogService } from "./log-service";
import { DatabaseService } from "./database-service";
import { ISubscriptionResult } from "../configure-queues-topics";
import * as utils from "../utils";
import Moment from 'moment';
import moment = require("moment");
import uuid from "uuid/v1";
import { stringify } from "querystring";
import { lookup, lookupService } from "dns";
import { QueryResult } from "pg";
import { RedisError } from "redis";

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

    async getHouses(houseid? : string) : Promise<House[]> {
        const result = await this.dbService!.query(`select id, name from house ${houseid ? `where id='${houseid}'` : ""}`);
        const houses = result.rows.map(row => {
            return {
                "id": row.id,
                "name": row.name
            }
        })
        return houses;
    }

    async createHouse(name : string) : Promise<House> {
        // validate name
        const usename = name.trim();
        if (usename.length > 128) return Promise.reject(Error('Supplied name maybe maximum 128 characters'));

        // generate id
        const houseid = uuid();

        // ensure unqiue name
        return this.getHouses().then(houses => {
            const houseWithSameName = houses.filter(h => h.name === name.trim());
            if (houseWithSameName.length !== 0) {
                // found house with same name
                return Promise.reject(Error('House with that name already exists'));
            } else {
                return this.dbService!.query(`insert into house (id, name) values ('${houseid}', '${name.trim()}')`);
            }
        }).then(result => {
            return this.getHouses(houseid);
        }).then(houses => {
            return houses[0];
        })
    }

    async updateHouse(id : string, name : string) : Promise<House> {
        // validate
        const usename = name.trim();
        if (usename.length > 128) return Promise.reject(Error('Supplied name maybe maximum 128 characters'));

        return this.getHouses().then((houses : House[]) => {
            // ensure id exists
            if (houses.filter(h => h.id === id).length !== 1) {
                // unable to find the house by id
                return Promise.reject(Error(`Unable to find house with ID <${id}>`));
            }

            // ensure name is unique
            if (houses.filter(h => h.name === name).length !== 0) {
                return Promise.reject(Error(`House name is not unique`));
            }
            
            // update house
            return this.dbService!.query(`update house set name='${usename}' where id='${id}'`);

        }).then(result => {
            return this.getHouses(id);
        }).then(houses => {
            return Promise.resolve(houses[0]);
        })
    }

    async deleteHouse(id : string) : Promise<void> {
        // validate
        const use_id = id.trim();

        return this.getHouses().then(houses => {
            // ensure id exists
            if (houses.filter(h => h.id === use_id).length !== 1) {
                // unable to find the house by id
                return Promise.reject(Error(`Unable to find house with ID <${id}>`));
            }
            
            // delete house
            return this.dbService!.query(`delete from house where id='${use_id}'`);

        }).then(result => {
            return Promise.resolve();
        })
    }

    async getDevices(houseId? : string) : Promise<Device[]> {
        const str_query = `select d.id deviceid, d.name devicename, d.notify "notify", d.muted_until "until", h.id houseid, h.name housename from device d left outer join house h on d.houseid=h.id${houseId ? ` where h.id='${houseId}'` : ""} order by d.name asc;`;
        const result = await this.dbService!.query(str_query);
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

    async createDevice(houseid : string, id : string, name : string) : Promise<Device> {
        // validate name
        const use_name = name.trim();
        const use_id = id.trim();
        const use_house = houseid.trim();
        if (!use_id || use_id.length > 36) return Promise.reject(Error('Supplied ID id not present or longer than the maximum 36 characters'));
        if (!use_name || use_name.length > 128) return Promise.reject(Error('Supplied name may not be present or longer than the maximum 128 characters'));
        if (!use_house || use_house.length > 36) return Promise.reject(Error('Supplied house ID not present or longer than the maximum 36 characters'));

        // get device by id
        return this.getDeviceById(use_id).then(device => {
            // we found a device with that ID - this is an error
            return Promise.reject(new StorageServiceError('Found existing device with ID', "found"));

        }).catch((err : StorageServiceError) => {
            // reject if own error
            if (err.code === "found") return Promise.reject(err);

            // success ID not known
            return this.dbService!.query(`insert into device (id, name, houseid) values ('${use_id}', '${use_name}', '${use_house}')`);

        }).then(result => {
            // return device
            return this.getDeviceById(use_id);
        })
    }

    async updateDevice(id : string, name : string) : Promise<Device> {
        // validate
        const use_name = name.trim();
        const use_id = id.trim();
        if (use_name.length > 128) return Promise.reject(Error('Supplied name maybe maximum 128 characters'));

        return this.getDevices().then(devices => {
            // ensure id exists
            if (devices.filter(d => d.id === use_id).length !== 1) {
                // unable to find the device by id
                return Promise.reject(Error(`Unable to find device with ID <${id}>`));
            }

            // ensure name is unique
            if (devices.filter(d => d.name === use_name).length !== 0) {
                return Promise.reject(Error(`Device name is not unique`));
            }
            
            // update device
            return this.dbService!.query(`update device set name='${use_name}' where id='${use_id}'`);

        }).then(result => {
            return this.getDeviceById(use_id);
        })
    }

    async deleteDevice(id : string) : Promise<void> {
        // validate
        const use_id = id.trim();

        return this.getDevices().then(devices => {
            // ensure id exists
            if (devices.filter(d => d.id === use_id).length !== 1) {
                // unable to find the device by id
                return Promise.reject(Error(`Unable to find device with ID <${id}>`));
            }
            
            // delete device
            return this.dbService!.query(`delete from device where id='${use_id}'`);

        }).then(result => {
            return Promise.resolve();
        })
    }


    async createSensor(deviceId : string, id : string, name : string, label : string, type : string) : Promise<Sensor> {
        // validate 
        const use_id = id.trim();
        const use_name = name.trim();
        const use_label = label.trim();
        const use_type = type.trim();
        if (use_id.length > 36) return Promise.reject(Error('Supplied ID maybe maximum 36 characters'));
        if (use_name.length > 128) return Promise.reject(Error('Supplied name maybe maximum 128 characters'));
        if (use_label.length > 128) return Promise.reject(Error('Supplied label maybe maximum 128 characters'));
        
        // ensure unqiue name
        return this.getDeviceById(deviceId).then((device : Device) => {
            // found device - good - see if we can find sensor by id
            return this.getSensorById(id);

        }).then((sensor : Sensor) => {
            // should not be able to find sensor
            return Promise.reject(new StorageServiceError(`Sensor with ID <${id}> already exists`, "found"));

        }).catch((err : StorageServiceError) => {
            // reject if own error
            if (err.code === "found") return Promise.reject(err);

            // create sensor in db
            console.log(`insert into sensor (deviceid, id, name, label, type) values ('${deviceId}', '${use_id}', '${use_name}', '${use_label}', '${use_type}')`);
            this.dbService?.query(`insert into sensor (deviceid, id, name, label, type) values ('${deviceId}', '${use_id}', '${use_name}', '${use_label}', '${use_type}')`);

        }).then(result => {
            return this.getSensorById(id);
        })
    }

    async updateSensor(id : string, name : string, label : string, type : string) : Promise<Sensor> {
        // validate
        const use_id = id.trim();
        const use_name = name.trim();
        const use_label = label.trim();
        const use_type = type.trim();
        if (use_id.length > 36) return Promise.reject(Error('Supplied ID maybe maximum 36 characters'));
        if (use_name.length > 128) return Promise.reject(Error('Supplied name maybe maximum 128 characters'));
        if (use_label.length > 128) return Promise.reject(Error('Supplied label maybe maximum 128 characters'));
        
        return this.getSensorById(id).then((sensor : Sensor) => {
            // update sensor
            return this.dbService!.query(`update sensor set name='${use_name}', label='${use_label}', type='${use_type}' where id='${id}'`);

        }).then(result => {
            return this.getSensorById(id);
        })
    }

    async deleteSensor(id : string) : Promise<void> {
        // validate
        const use_id = id.trim();

        return this.getSensorById(id).then(sensor => {
            // delete sensor
            return this.dbService!.query(`delete from sensor where id='${use_id}'`);

        }).then(result => {
            return Promise.resolve();
        })
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

            const err = new StorageServiceError(`Unable to find a single device with id <${deviceId}>`, "not_found");
            return Promise.reject(err);
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

    updateDeviceNotificationState(device : string | Device, newState : WatchdogNotification, mutedUntil? : Moment.Moment) : Promise<Device> {
        const device_id = typeof device === "string" ? device : device.id;
        if (newState === WatchdogNotification.muted && !mutedUntil) {
            mutedUntil = moment().add(7, "days");
        }
        let str_muted_until = newState === WatchdogNotification.muted ? mutedUntil?.toISOString() : undefined;
        let p : Promise<QueryResult<any>>;
        switch (newState) {
            case WatchdogNotification.muted:
                p = this.dbService!.query(`update device set notify=${newState}, muted_until='${str_muted_until}' where id='${device_id}'`)
                break;
            default:
                p = this.dbService!.query(`update device set notify=${newState}, muted_until=NULL where id='${device_id}'`)
        }
        return p.then(result => {
            return this.getDeviceById(device_id);
        })
    }

    async getLastNSamplesForSensor(sensorId : string, samples : number = 100) : Promise<SensorSample[] | undefined> {
        return this.dbService?.query(`select value, dt from sensor_data where id='${sensorId}' order by dt desc limit ${samples}`).then(result => {
            const arr = result.rows.map(row => {
                return {
                    "id": sensorId,
                    "dt": row.dt,
                    "dt_string": utils.formatDate(row.dt),
                    "value": row.value
                } as SensorSample;
            })
            return Promise.resolve(arr);
        })
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

    getSensors(deviceId? : string) : Promise<Sensor[]> {
        return this.dbService!.query(`select s.id sensorid, s.name sensorname, s.type sensortype, s.label sensorlabel, d.id deviceid, d.name devicename, h.id houseid, h.name housename from sensor s join device d on s.deviceid=d.id left outer join house h on d.houseid=h.id ${deviceId ? ` where s.deviceid='${deviceId}'` : ""} order by s.name asc`).then(result => {
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
                        "deviceId": data.deviceId,
                        "id": data.sensorId,
                        "dt": new Date(),
                        "value": data.value
                    }
                } else {
                    // parse string from sensor
                    redis_sensor = JSON.parse(str_sensor);
                    redis_sensor.dt = new Date();
                    redis_sensor.value = data.value;
                    redis_sensor.deviceId = data.deviceId;
                }

                // set sensor in Redis
                this.logService!.debug(`Adding sensor with key <${SENSOR_KEY_PREFIX}${data.sensorId}> (device <${data.deviceId}>) to Redis`);
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
                    return Promise.all([sensor, sensor.device]);
                });

            }).catch(err => {
                // unknown sensor - mark msg as consumed and return promise
                result.callback();
                return Promise.all([Promise.resolve(undefined), this.getDeviceById(msg.deviceId)]);

            }).then((data : any) => {
                const sensor : Sensor | undefined = data[0];
                const device = data[1] as Device;

                // create an augmented sensor reading and post to topic
                const payload = {
                    "deviceId": device.id,
                    "value": msg.value,
                    "sensorId": msg.id
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
                this.eventService!.publishTopic(constants.TOPICS.CONTROL, device ? `known.${msg.type}` : `unknown.${msg.type}`, payload);
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
                if (!result.routingKey) {
                    this.logService?.debug("Ignoring control topic message as no routing key");
                } else if (result.routingKey?.indexOf(`.${ControlMessageTypes.restart}`) > 0) {
                    redis_device.restarts++;
                } else if (result.routingKey?.indexOf(`.${ControlMessageTypes.watchdogReset}`) > 0) {
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
                    if (redisObj) resultArray.push(utils.convert(redisObj, sensor));
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
                        "notify": device ? device.notify : WatchdogNotification.no,
                        "mutedUntil": device ? device.mutedUntil : undefined,
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

class StorageServiceError extends Error {
    readonly isStorageServiceError : boolean = true;
    readonly code : string = "unknown";
    constructor(msg : string | undefined, code : string) {
        super(msg);
        this.code = code;
    }
}
