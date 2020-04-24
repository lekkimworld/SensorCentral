import constants from "../constants";
import {BaseService, Device, Sensor, House, SensorType, TopicSensorMessage, RedisSensorMessage, 
    TopicDeviceMessage, TopicControlMessage, RedisDeviceMessage, ControlMessageTypes, 
    IngestedSensorMessage, IngestedDeviceMessage, IngestedControlMessage, WatchdogNotification, 
    SensorSample, NotifyUsing, PushoverSettings, DeviceWatchdogNotifier, 
    LoginSource, BackendLoginUser, NotificationSettings, LoginUser } from "../types";
import { EventService } from "./event-service";
import { RedisService } from "./redis-service";
import { LogService } from "./log-service";
import { DatabaseService } from "./database-service";
import { ISubscriptionResult } from "../configure-queues-topics";
import * as utils from "../utils";
import Moment from 'moment';
import moment = require("moment");
import uuid from "uuid/v1";
import { CreateSensorType, UpdateSensorType, DeleteSensorType } from "../resolvers/sensor";
import { DeleteDeviceInput, UpdateDeviceInput, CreateDeviceInput } from "../resolvers/device";
import { CreateHouseInput, UpdateHouseInput, DeleteHouseInput } from "../resolvers/house";
import { WatchdogNotificationInput } from "../resolvers/device-watchdog";
import { QueryResult } from "pg";
import { UpdateSettingsInput } from "src/resolvers/settings";

const SENSOR_KEY_PREFIX = 'sensor:';
const DEVICE_KEY_PREFIX = 'device:';
const LOGIN_KEY_PREFIX = 'login:';

export interface CreateLoginUserInput {
    source : LoginSource;
    oidc_sub : string;
    email : string;
    fn : string;
    ln : string;
}

/**
 * Converts sensors from the query result to an array of sensors
 * @param result 
 */
const convertRowsToSensors = (result : QueryResult) => {
    return result.rows.map(row => {
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
    });
}

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

    /**
     * Returns the house with the supplied ID.
     * 
     * @param houseid ID of the house to return
     * @throws Error is house not found
     */
    async getHouse(houseid : string) {
        const result = await this.dbService!.query(`select id, name from house where id=$1`, houseid);
        if (result.rowCount !== 1) {
            throw Error(`Unable to find a single House with ID <${houseid}>`);
        }

        const row = result.rows[0];
        return {
            "id": row.id,
            "name": row.name
        } as House;
    }

    /**
     * Returns all the houses.
     * 
     */
    async getHouses() {
        const result = await this.dbService!.query("select id, name from house");
        return result.rows.map(row => {
            return {
                "id": row.id,
                "name": row.name
            }
        }) as House[];
    }

    /**
     * Creates the house with the supplied name,
     * 
     * @param data Name of the house
     */
    async createHouse({name} : CreateHouseInput) {
        // validate name
        const use_name = name.trim();
        
        // generate id
        const house_id = uuid();

        // ensure unqiue name
        const houses = await this.getHouses();
        const houseWithSameName = houses.filter(h => h.name === name.trim());
        if (houseWithSameName.length !== 0) {
            // found house with same name
            throw Error(`House with that name (${use_name}) already exists`);
        }

        // insert house row
        await this.dbService!.query("insert into house (id, name) values ($1, $2)", house_id, use_name);

        // publish event
        await this.eventService?.publishTopic(constants.TOPICS.CONTROL, "house.create", {
            "new": {
                "id": house_id,
                "name": use_name
            }
        });

        // return house
        return this.getHouse(house_id);
    }

    /**
     * Updates the house with the supplied ID setting the name
     * @param id ID of house to update
     * @param name New name of house
     * @throws Error is house cannot be found
     */
    async updateHouse({id, name} : UpdateHouseInput) {
        // validate
        const use_id = id.trim();
        const use_name = name.trim();

        // get house
        const house = await this.getHouse(use_id);
        
        // update house
        const result = await this.dbService!.query(`update house set name=$1 where id=$2`, use_name, use_id);
        if (!result || result.rowCount !== 1) {
            throw Error(`Unable to update house with ID <${use_id}>`);
        }

        // publish event
        await this.eventService?.publishTopic(constants.TOPICS.CONTROL, "house.update", {
            "new": {
                "id": use_id,
                "name": use_name
            },
            "old": {
                "id": house.id,
                "name": house.name
            }
        });

        // return the house
        return this.getHouse(use_id);
    }

    /**
     * Deletes house with supplied ID.
     * @param id 
     */
    async deleteHouse({id} : DeleteHouseInput) {
        // validate
        const use_id = id.trim();
        
        // get the house to ensure it exists
        const house = await this.getHouse(use_id);

        // publish event
        await this.eventService?.publishTopic(constants.TOPICS.CONTROL, "house.delete", {
            "old": {
                "id": house.id,
                "name": house.name
            }
        });
        
        // delete house
        await this.dbService!.query("delete from house where id=$1", use_id);
    }

    /**
     * Returns the devices for the house with the supplied ID
     * 
     * @param houseId ID of the house for which you like devices. If not supplied you get all devices.
     */
    async getDevices(houseId? : string) {
        if (houseId) {
            // lookup house to ensure it exists
            await this.getHouse(houseId);
        }
        
        // query to devices
        let result;
        if (houseId) {
            result = await this.dbService?.query("select d.id deviceid, d.name devicename, h.id houseid, h.name housename from device d left outer join house h on d.houseid=h.id where h.id=$1 order by d.name asc", houseId);
        } else {
            result = await this.dbService?.query("select d.id deviceid, d.name devicename, h.id houseid, h.name housename from device d left outer join house h on d.houseid=h.id order by d.name asc");
        }
        if (!result) throw Error(`Unable to lookup devices (house ID <${houseId}>)`);
        
        // return house
        const devices = result.rows.map(row => {
            return {
                "id": row.deviceid,
                "name": row.devicename,
                "house": {
                    "id": row.houseid,
                    "name": row.housename
                }
            } as Device;
        });
        return devices;
    }

    /**
     * Returns the device with the supplied ID.
     * 
     * @param deviceId ID of the device
     * @throws If device not found
     */
    async getDevice(deviceId : string) {
        const result = await this.dbService?.query("select d.id deviceid, d.name devicename, h.id houseid, h.name housename from device d left outer join house h on d.houseid=h.id where d.id=$1", deviceId);
        if (!result || result.rowCount !==1 ) {
            throw Error(`Unable to execute query or unable to find device with ID <${deviceId}>`);
        }

        const row = result.rows[0];
        return {
            "id": row.deviceid, 
            "name": row.devicename,
            "house": {
                "id": row.houseid,
                "name": row.housename
            } as House
        } as Device;
    }

    /**
     * Creates device in the database and returns the device. The ID of the device 
     * must be unique i the database.
     * 
     * @param houseid ID of the house the device belongs to
     * @param id ID of the device (must be unique in the db)
     * @param name Name of the device
     * @throws Error if the insertion cannot happen
     */
    async createDevice({houseId, id, name} : CreateDeviceInput) {
        // validate name
        const use_name = name.trim();
        const use_id = id.trim();
        const use_house = houseId.trim();
        
        // try and insert device
        await this.dbService!.query(`insert into device (id, name, houseid) values ($1, $2, $3)`, use_id, use_name, use_house);

        // publish event
        await this.eventService?.publishTopic(constants.TOPICS.CONTROL, "device.create", {
            "new": {
                "id": use_id,
                "name": use_name
            }
        });

        // return created device
        return this.getDevice(use_id);
    }

    /**
     * Updates the device with the supplied name with the supplied name.
     * 
     * @param id ID of the device
     * @param name New name of the device
     * @throws Error if device not found
     */
    async updateDevice({id, name} : UpdateDeviceInput) {
        // validate
        const use_name = name.trim();
        const use_id = id.trim();

        // get device
        const device = await this.getDevice(use_id);
        
        // attempt to update the device
        const result = await this.dbService?.query("update device set name=$1 where id=$2", use_name, use_id);
        if (!result || result.rowCount !== 1) {
            throw Error(`Unable to update device with ID <${use_id}>`);
        }

        // publish event
        await this.eventService?.publishTopic(constants.TOPICS.CONTROL, "device.update", {
            "new": {
                "id": use_id,
                "name": use_name
            },
            "old": {
                "id": use_id,
                "name": device.name
            }
        });

        // return
        return this.getDevice(use_id);
    }

    /**
     * Deletes the device with the supplied id.
     * 
     * @param id ID of device to delete.
     * @throws Error if device cannot be deleted
     */
    async deleteDevice({id} : DeleteDeviceInput) {
        // validate
        const use_id = id.trim();

        // get device
        const device = await this.getDevice(use_id);

        // attempt to delete the device
        const result = await this.dbService?.query("delete from device where id=$1", use_id);
        if (!result || result.rowCount !== 1) {
            throw Error(`Unable to delete with ID <${use_id}>`);
        }

        // publish event
        await this.eventService?.publishTopic(constants.TOPICS.CONTROL, "device.delete", {
            "old": {
                "id": use_id,
                "name": device.name
            }
        });
    }

    /**
     * Return all sensors for device with supplied ID
     * @param deviceId ID of device to get sensors for
     * @throws Error if device not found
     */
    async getSensors(deviceId : string) {
        const use_id = deviceId.trim();

        // get the device
        await this.getDevice(use_id);
        
        // query 
        const result = await this.dbService!.query("select s.id sensorid, s.name sensorname, s.type sensortype, s.label sensorlabel, d.id deviceid, d.name devicename, h.id houseid, h.name housename from sensor s join device d on s.deviceid=d.id left outer join house h on d.houseid=h.id where s.deviceid=$1 order by s.name asc", deviceId);
        const sensors = convertRowsToSensors(result);
        return sensors;
    }

    /**
     * Returns sensor with specified ID
     * @param sensorId ID of sensor to lookup
     * @throws Error if sensor not found
     */
    async getSensor(sensorId : string) {
        // trim id
        const use_id = sensorId.trim();

        // get sensor
        const result = await this.dbService!.query("select s.id sensorid, s.name sensorname, s.type sensortype, s.label sensorlabel, d.id deviceid, d.name devicename, h.id houseid, h.name housename from sensor s join device d on s.deviceid=d.id left outer join house h on d.houseid=h.id where s.id=$1 order by s.name asc", use_id);
        if (!result || result.rowCount !== 1) {
            throw Error(`Unable to find sensor with ID <${sensorId}>`);
        }

        const sensors = convertRowsToSensors(result);
        return sensors[0];

    }

    async createSensor({deviceId, id, name, label, type} : CreateSensorType) {
        // validate 
        const use_id = id.trim();
        const use_name = name.trim();
        const use_label = label.trim();
        
        // get device to ensure it exists
        await this.getDevice(deviceId);

        // create sensor
        await this.dbService?.query(`insert into sensor (deviceid, id, name, label, type) values ($1, $2, $3, $4, $5)`, deviceId, use_id, use_name, use_label, type);

        // get sensor
        const sensor = await this.getSensor(use_id);

        // publish event
        await this.eventService?.publishTopic(constants.TOPICS.CONTROL, "sensor.create", {
            "new": {
                "deviceId": deviceId,
                "id": use_id,
                "name": use_name,
                "label": use_label,
                "type": type
            }
        });

        // return
        return sensor;
    }

    async updateSensor({id, name, label, type} : UpdateSensorType) {
        // validate
        const use_id = id.trim();
        const use_name = name.trim();
        const use_label = label.trim();
        
        // get sensor
        const sensor = await this.getSensor(use_id);

        // update sensor
        const result = await this.dbService?.query("update sensor set name=$1, label=$2, type=$3 where id=$4", use_name, use_label, type, use_id);
        if (!result || result.rowCount !== 1) {
            throw Error(`Unable to update sensor with ID <${use_id}>`);
        }

        // publish event
        await this.eventService?.publishTopic(constants.TOPICS.CONTROL, "sensor.update", {
            "new": {
                "deviceId": sensor.deviceId,
                "name": use_name,
                "label": use_label,
                "type": type
            },
            "old": {
                "deviceId": sensor.deviceId,
                "id": use_id,
                "name": sensor.name,
                "label": sensor.label,
                "type": sensor.type
            }
        });

        // return
        return this.getSensor(use_id);

    }

    async deleteSensor({id} : DeleteSensorType) {
        // validate
        const use_id = id.trim();

        // get sensor
        const sensor = await this.getSensor(use_id);

        // delete the sensor
        await this.dbService?.query("delete from sensor where id=$1", use_id);
        
        // publish event
        await this.eventService?.publishTopic(constants.TOPICS.CONTROL, "sensor.delete", {
            "old": {
                "deviceId": sensor.deviceId,
                "id": use_id,
                "name": sensor.name,
                "label": sensor.label,
                "type": sensor.type
            }
        });
    }

    /**
     * Given a device ID returns the notification settings for that device.
     * 
     * @param deviceId 
     */
    async getDeviceWatchdogNotifiers(deviceId : string) {
        const result = await this.dbService!.query("select id, email, fn, ln,default_notify_using, pushover_userkey, pushover_apptoken, dw.notify, dw.muted_until from login_user l, device_watchdog dw where l.id=dw.userId and dw.deviceId=$1", deviceId);
        return result.rows.map(r => {
            let notifyUsing;
            if (r.default_notify_using === "email") {
                notifyUsing = NotifyUsing.email;
            } else if (r.default_notify_using === "pushover") {
                notifyUsing = NotifyUsing.pushover;
            }
            let notify;
            if (r.notify === "yes") {
                notify = WatchdogNotification.yes;
            } else if (r.notify === "no") {
                notify = WatchdogNotification.no;
            } else if (r.notify === "muted") {
                notify = WatchdogNotification.muted;
            }
            let pushover : PushoverSettings | undefined;
            if (r.pushover_userkey && r.pushover_apptoken) {
                pushover = {
                    "userkey": r.pushover_userkey,
                    "apptoken": r.pushover_apptoken
                }
            }

            // create and return notifier
            const notifier = {
                notify,
                "mutedUntil": r.muted_until ? moment.utc(r.muted_until) : undefined,
                "user": {
                    "id": r.id,
                    "email": r.email,
                    "fn": r.fn,
                    "ln": r.ln
                } as LoginUser,
                "settings": {
                    notifyUsing,
                    pushover
                } as NotificationSettings
            } as DeviceWatchdogNotifier;

            return notifier;
        })
    }

    async getDeviceWatchdog(context : BackendLoginUser, deviceId : string) {
        context;
        deviceId;        
    }

    async updateDeviceWatchdog(context : BackendLoginUser, data : WatchdogNotificationInput, mutedUntil? : Moment.Moment) {
        if (data.notify === WatchdogNotification.muted && !mutedUntil) {
            mutedUntil = moment().add(7, "days");
        }
        let str_muted_until = data.notify === WatchdogNotification.muted ? mutedUntil?.toISOString() : undefined;
        
        let result = await this.dbService!.query("select userId, deviceId from device_watchdog where userId=$1 AND deviceId=$2", context.id, data.id);
        if (!result || result.rowCount === 0) {
            // insert
            result = await this.dbService!.query("insert into device_watchdog (notify, muted_until, userId, deviceId) values ($1, $2, $3, $4)", data.notify, str_muted_until, context.id, data.id);
        } else {
            // update
            result = await this.dbService!.query("update device_watchdog set notify=$1, muted_until=$2 where userId=$3 AND deviceId=$4", data.notify, str_muted_until, context.id, data.id);
        }
        console.log(result);
    }

    async getOrCreateLoginUser({source, oidc_sub, email, fn, ln} : CreateLoginUserInput) : Promise<BackendLoginUser> {
        // see if we can find the user by sub based on source
        let result : QueryResult | undefined;
        switch (source) {
            case LoginSource.google:
                result = await this.dbService!.query("select id, email, fn, ln, google_sub from login_user where google_sub=$1 OR email=$2", oidc_sub, email);
                break;
            default:
                throw Error(`Unhandled LoginSource <${source}>`);
        }

        if (result && result.rowCount === 1) {
            // found user - ensure it contains the sub for the oidc
            const row = result.rows[0];
            switch (source) {
                case LoginSource.google:
                    if (row.google_sub !== oidc_sub) {
                        // we need to update it
                        await this.dbService?.query("update login_user set google_sub=$1 where email=$2", oidc_sub, email)
                    }
                    break;
            }

            // return
            return {
                email,
                "id": row.id,
                "houseId": "*",
                "fn": row.fn,
                "ln": row.ln,
                "scopes": constants.DEFAULTS.JWT.USER_SCOPES
            } as BackendLoginUser;
        } else {
            // we need to add the user
            const id = uuid();
            switch (source) {
                case LoginSource.google:
                    await this.dbService!.query("insert into login_user (id, email, fn, ln, google_sub) values ($1, $2, $3, $4, $5)", id, email, fn, ln, oidc_sub);
                    break;
            }

            // return
            return {
                id,
                email,
                fn,
                ln, 
                houseId: "*",
                scopes: constants.DEFAULTS.JWT.USER_SCOPES
            } as BackendLoginUser;
        }
    }

    /**
     * Finds the BackendLoginUser instance for the id supplied in Redis or 
     * looks up in the database and caches in Redis.
     * 
     * @param id User or Device ID
     */
    async lookupBackendLoginUser(id : string) {
        // start in redis
        const redisKey = `${LOGIN_KEY_PREFIX}:${id}`;
        const str_user = await this.redisService!.get(redisKey);
        if (str_user) {
            const user_obj = JSON.parse(str_user) as BackendLoginUser;
            return user_obj;
        }

        // not found - look up in database
        const result = await this.dbService!.query("select id, fn, ln, email from login_user where id=$1", id);
        let user_obj : BackendLoginUser;
        if (!result || result.rowCount === 0) {
            // maybe a device - look for device
            try {
                // found device
                const device = await this.getDevice(id);
                user_obj = {
                    "id": device.id,
                    "houseId": device.house.id,
                    "scopes": constants.DEFAULTS.JWT.DEVICE_SCOPES
                }
            } catch (err){
                throw Error(`Unable to find user OR device with id <${id}>`);
            }
        } else {
            // found user - create object
            const row = result.rows[0];
            user_obj = {
                "id": row.id,
                "fn": row.fn,
                "ln": row.ln,
                "email": row.email,
                "houseId": "*",
                "scopes": constants.DEFAULTS.JWT.USER_SCOPES
            };
        }

        // save in redis (do not wait)
        this.redisService!.set(redisKey, JSON.stringify(user_obj));

        // return 
        return user_obj;
    }

    async settings(user : BackendLoginUser) {
        const result = await this.dbService!.query("select default_notify_using, pushover_userkey, pushover_apptoken from login_user where id=$1", user.id);
        if (!result || !result.rowCount) throw Error(`Unable to find login with ID <${user.id}>`);

        const r = result.rows[0];
        const notifyUsing = (function(n : string) {
            if (!n) return undefined;
            switch (n) {
                case "pushover":
                    return NotifyUsing.pushover;
                case "email":
                    return NotifyUsing.email;
            }
        })(r.default_notify_using);
        const pushover = (function(userkey : string, apptoken : string) {
            if (userkey && apptoken) {
                return {
                    apptoken,
                    userkey
                } as PushoverSettings;
            }
        })(r.pushover_userkey, r.pushover_apptoken);

        return {
            notifyUsing,
            pushover
        } as NotificationSettings;
    }

    async updateSettings(user : BackendLoginUser, data : UpdateSettingsInput) {
        await this.dbService!.query("update login_user set default_notify_using=$1, pushover_apptoken=$2, pushover_userkey=$3 where id=$4", data.notify_using, data.pushover_apptoken, data.pushover_userkey, user.id);
    }

    /**
     * Returns the sensors marked as favorite for the supplied user.
     * 
     * @param user 
     */
    async getFavoriteSensors(user : BackendLoginUser) {
        const result = await this.dbService!.query("select s.id sensorid, s.name sensorname, s.type sensortype, s.label sensorlabel, d.id deviceid, d.name devicename, h.id houseid, h.name housename from sensor s join device d on s.deviceid=d.id left outer join house h on d.houseid=h.id where s.id in (select sensorId from favorite_sensor where userId=$1) order by s.name asc", user.id);
        const sensors = convertRowsToSensors(result);
        return sensors;
    }

    /**
     * Adds the sensor with the supplied ID as a favorite sensor.
     * 
     * @param user 
     * @param id
     */
    async addFavoriteSensor(user : BackendLoginUser, id : string) {
        await this.dbService!.query("insert into favorite_sensor (userId, sensorId) values ($1, $2) on conflict do nothing", user.id, id);
    }

    /**
     * Removes the sensor with the supplied ID as a favorite sensor.
     * 
     * @param user 
     * @param id
     */
    async removeFavoriteSensor(user : BackendLoginUser, id : string) {
        await this.dbService!.query("delete from favorite_sensor where userId=$1 and sensorId=$2", user.id, id);
    }






    



    getDeviceIds() : Promise<string[]> {
        return this.getDevices("foo").then(devices => {
            const deviceIds = devices.map(device => device.id) as string[];
            return Promise.resolve(deviceIds);
        })
    }

    getDeviceById(deviceId : string) : Promise<Device> {
        return this.getDevices("foo").then(devices => {
            const filtered = devices.filter(device => device.id === deviceId);
            if (filtered.length === 1) return Promise.resolve(filtered[0]);

            const err = new StorageServiceError(`Unable to find a single device with id <${deviceId}>`, "not_found");
            return Promise.reject(err);
        })
    }

    getDevicesByIds(deviceIds : string[]) : Promise<Device[]> {
        // get all devices
        return this.getDevices("foo").then(devices => {
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
/*     getKnownDevicesStatus() : Promise<DeviceStatus[]> {
        return this.getDevicesStatuses(true);
    } */

    /**
     * Returns the unknown devices we have recently heard from i.e. that has a value in 
     * Redis.
     */
/*     getUnknownDevicesStatus() : Promise<DeviceStatus[]> {
        return this.getDevicesStatuses(false);
    } */

    

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
/*     getKnownSensorsWithRecentReadings() : Promise<SensorReading[]> {
        return this.getSensorsWithRecentReadings(true);
    } */

    /**
     * Returns the unknown sensors we have recently heard from i.e. that has a value in 
     * Redis.
     */
/*     getUnknownSensorsWithRecentReadings() : Promise<SensorReading[]> {
        return this.getSensorsWithRecentReadings(false);
    } */

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



    /**
     * Return the ids of the sensors we know of.
     * 
     */
/*     getSensorIds() : Promise<string[]> {
        return this.getSensors().then(sensors => {
            return Promise.resolve(sensors.map(sensor => sensor.id));
        })
    } */

    /**
     * Returns a map mapping the supplied ids to sensors if we know the sensor or 
     * undefined otherwise.
     * 
     * @param sensorIds 
     */
/*     getSensorMapByIds(sensorIds : string[]) : Promise<Map<string,Sensor|undefined>> {
        return this.getSensorsByIds(sensorIds).then(sensors => {
            const result = sensors.reduce((prev, sensor) => {
                prev.set(sensor.id, sensor);
                return prev;
            }, new Map<string,Sensor|undefined>());
            
            sensorIds.filter(id => !result.has(id)).forEach(id => result.set(id, undefined));
            return Promise.resolve(result);
        })
    } */

    /**
     * Returns the sensors with the supplied ids. If a sensor isn't known it is 
     * simply not returned.
     * 
     * @param sensorIds 
     */
/*     getSensorsByIds(sensorIds : string[]) : Promise<Sensor[]> {
        // get all sensors
        return this.getSensors().then(sensors => {
            // filter them
            const filtered = sensors.filter(sensor => sensorIds.includes(sensor.id));
            
            // resolve promise
            return Promise.resolve(filtered);
        })
    } */

    /**
     * Return a single sensor by id.
     * 
     * @param sensorId 
     */
/*     getSensorById(sensorId : string) : Promise<Sensor> {
        return this.getSensors().then(sensors => {
            const filtered = sensors.filter(sensor => sensor.id === sensorId);
            if (filtered.length != 1) {
                return Promise.reject(Error(`Unable to find a single sensor with id <${sensorId}>`));
            } else {
                return Promise.resolve(filtered[0]);
            }
        })
    } */

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
     * @param dt
     */
    private persistSensorReading(id : string, value : number, dt? : moment.Moment) : Promise<void> {
        let str_sql;
        let args = [id, value];
        if (dt) {
            args.push(dt.toISOString());
            str_sql = "insert into sensor_data (id, value, dt) values ($1, $2, $3)";
        } else {
            str_sql = "insert into sensor_data (id, value, dt) values ($1, $2, current_timestamp)";
        }
        return this.dbService!.query(str_sql, ...args).then(() => {
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
            this.getSensor(msg.id).then(sensor => {
                // known sensor - persist reading (with dt if supplied)
                let dt : Moment.Moment | undefined;
                if (msg.dt) {
                    dt = moment.utc(msg.dt)
                }
                return this.persistSensorReading(sensor.id, msg.value, dt).then(() => {
                    // mark msg as consumed
                    result.callback();

                    // return promise
                    return Promise.all([sensor, sensor.device]);
                });

            }).catch(() => {
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
            this.getDeviceById(msg.id).catch(() => {
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
            this.getDeviceById(msg.id).catch(() => {
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
/* 
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
                        "notify": undefined, //device ? device.notify : WatchdogNotification.no,
                        "mutedUntil": undefined,  //device ? device.mutedUntil : undefined,
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
    } */
}

class StorageServiceError extends Error {
    readonly isStorageServiceError : boolean = true;
    readonly code : string = "unknown";
    constructor(msg : string | undefined, code : string) {
        super(msg);
        this.code = code;
    }
}
