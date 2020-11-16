import constants from "../constants";
import {BaseService, Device, Sensor, House, 
    WatchdogNotification, 
    SensorSample, NotifyUsing, PushoverSettings, DeviceWatchdogNotifier, 
    NotificationSettings, LoginUser, DeviceWatchdog } from "../types";
import { EventService } from "./event-service";
import { RedisService } from "./redis-service";
import { LogService } from "./log-service";
import { DatabaseService } from "./database-service";
import Moment from 'moment';
import moment = require("moment");
import uuid from "uuid/v1";
import { CreateSensorType, UpdateSensorType, DeleteSensorType } from "../resolvers/sensor";
import { DeleteDeviceInput, UpdateDeviceInput, CreateDeviceInput } from "../resolvers/device";
import { CreateHouseInput, UpdateHouseInput, DeleteHouseInput, FavoriteHouseInput } from "../resolvers/house";
import { WatchdogNotificationInput } from "../resolvers/device-watchdog";
import { QueryResult } from "pg";
import { UpdateSettingsInput } from "../resolvers/settings";
//@ts-ignore
import aes256 from "aes256";
import { Smartme } from "smartme-protobuf-parser";

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
            "type": row.sensortype as string,
            "icon": row.sensoricon,
            "scaleFactor": row.sensorscalefactor,
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
    public static NAME = "storage";
    dbService? : DatabaseService;
    logService? : LogService;
    eventService? : EventService;
    redisService? : RedisService;

    constructor() {
        super(StorageService.NAME);
        this.dependencies = [
            DatabaseService.NAME, LogService.NAME, 
            EventService.NAME, RedisService.NAME];
    }

    init(callback : (err?:Error) => {}, services : BaseService[]) {
        this.dbService = services[0] as unknown as DatabaseService;
        this.logService = services[1] as unknown as LogService;
        this.eventService = services[2] as unknown as EventService;
        this.redisService = services[3] as unknown as RedisService;

        // did init
        callback();
    }

    /**
     * Try and lookup powerdata in cache. 
     * @param key 
     */
    async getPowerData(key : string) : Promise<object | undefined> {
        const data = await this.redisService!.get(`powerdata_${key}`);
        if (data) {
            this.redisService!.expire(`powerdata_${key}`, constants.DEFAULTS.REDIS.POWERDATA_EXPIRATION_SECS);
            return JSON.parse(data);
        } else {
            return undefined;
        }
    }

    /**
     * Set powerdata in cache. 
     * @param key 
     * @param data 
     */
    async setPowerData(key : string, data : object) {
        const str = JSON.stringify(data);
        return await this.redisService!.setex(
            `powerdata_${key}`, 
            constants.DEFAULTS.REDIS.POWERDATA_EXPIRATION_SECS, 
            str);
    }

    /**
     * Store temporary data in redis with the supplied TTL.
     * 
     * @param key 
     * @param ttl 
     * @param data 
     */
    async setTemporaryData(key : string, ttl : number, data : string) {
        this.redisService!.setex(key, ttl, data);
    }

    /**
     * Get temporary data out of Redis.
     * 
     * @param key 
     */
    async getTemporaryData(key : string) : Promise<string> {
        return this.redisService!.get(key);
    }

    /**
     * Returns the house with the supplied ID.
     * 
     * @param houseid ID of the house to return
     * @throws Error is house not found or calling user do not have access to the house
     */
    async getHouse(user : LoginUser, houseid : string) : Promise<House> {
        let result;
        if (this.isAllAccessUser(user)) {
            result = await this.dbService!.query(`select id, name from house h where h.id=$1`, houseid);
            if (result.rowCount !== 1) throw Error(`Unable to find a single House with ID <${houseid}>`);
        } else {
            result = await this.dbService!.query(`select id, name from house h, user_house_access u where h.id=u.houseId and u.houseId=$2 and u.userId=$1`, user.id, houseid);
            if (result.rowCount !== 1) throw Error(`Unable to find a single House with ID or the user do not have access <${houseid}>`);
        }        

        // create house
        const row = result.rows[0];
        return {
            "id": row.id,
            "name": row.name
        } as House;
    }

    /**
     * Returns all the houses.
     * 
     * @param user
     */
    async getHouses(user : LoginUser) : Promise<House[]> {
        let result;
        if (this.isAllAccessUser(user)) {
            result = await this.dbService!.query("select id, name from house h");
        } else {
            result = await this.dbService!.query("select id, name from house h, user_house_access u where u.userId=$1 and h.id=u.houseId", user.id);
        }

        // map to houses
        return result.rows.map(row => {
            return {
                "id": row.id,
                "name": row.name
            }
        }) as House[];
    }

    /**
     * Returns the houses for the supplied user ID.
     * @param user 
     * @param userId 
     * @throws Error if called by non service principal
     */
    async getHousesForUser(user : LoginUser, userId : string) : Promise<House[]> {
        if (this.isAllAccessUser(user)) {
            return this.getHouses({
                "id": userId,
                "houseId": "*"
            } as LoginUser)
        } else {
            throw Error("May only be called by service principal");
        }
    }

    /**
     * Creates the house with the supplied name,
     * 
     * @param user User owning the house
     * @param data Name of the house
     */
    async createHouse(user : LoginUser, {name} : CreateHouseInput) : Promise<House> {
        // validate name
        const use_name = name.trim();
        
        // generate id
        const house_id = uuid();

        // ensure unqiue name
        const houses = await this.getHouses(user);
        const houseWithSameName = houses.filter(h => h.name === name.trim());
        if (houseWithSameName.length !== 0) {
            // found house with same name
            throw Error(`House with that name (${use_name}) already exists`);
        }

        // insert house row
        await new Promise((resolve, reject) => {
            this.dbService!.query("BEGIN").then(() => {
                return this.dbService!.query("insert into house (id, name) values ($1, $2)", house_id, use_name);
            }).then(() => {
                this.dbService!.query("insert into user_house_access (userId, houseId) values ($1, $2)", user.id, house_id);
            }).then(() => {
                this.dbService!.query("COMMIT");
                resolve();
            }).catch(err => {
                this.logService!.warn(`Unable to create house due to error: ${err.message}`);
                reject(err);
            })
        })

        // publish event
        this.eventService?.publishTopic(constants.TOPICS.CONTROL, "house.create", {
            "new": {
                "id": house_id,
                "name": use_name
            },
            "user": user
        });

        // return house
        return this.getHouse(user, house_id);
    }

    /**
     * Updates the house with the supplied ID setting the name
     * 
     * @param user
     * @param id ID of house to update
     * @param name New name of house
     * @throws Error is house cannot be found or user do not have access to the house
     */
    async updateHouse(user : LoginUser, {id, name} : UpdateHouseInput) : Promise<House>{
        // validate
        const use_id = id.trim();
        const use_name = name.trim();

        // get house
        const house = await this.getHouse(user, use_id);

        // update house
        const result = await this.dbService!.query(`update house set name=$1 where id=$2`, use_name, use_id);
        if (!result || result.rowCount !== 1) {
            throw Error(`Unable to update house with ID <${use_id}>`);
        }

        // publish event
        this.eventService?.publishTopic(constants.TOPICS.CONTROL, "house.update", {
            "new": {
                "id": use_id,
                "name": use_name
            },
            "old": {
                "id": house.id,
                "name": house.name
            },
            "user": user
        });

        // return the house
        return this.getHouse(user, use_id);
    }

    /**
     * Favorites the house for the current house.
     * 
     * @param user 
     * @param data 
     */
    async favoriteHouse(user : LoginUser, {id} : FavoriteHouseInput) : Promise<House> {
        return this.dbService!.query(`BEGIN;`).then(() => {
            return this.dbService!.query("select userId, houseId, is_default from user_house_access where userId=$1 and houseId=$2", user.id, id);
        }).then(result => {
            if (result.rowCount !== 1) {
                // user do not have access
                return Promise.reject(Error('User trying to favorite a house they do not have access to'));
            }

            // mark all user houses as not-default
            return this.dbService!.query(`update user_house_access set is_default=false WHERE userId=$1`, user.id); 
        }).then(() => {
            return this.dbService!.query(`update user_house_access set is_default=true where userId=$1 and houseId=$2;`, user.id, id); 
        }).then(() => {
            return this.dbService!.query(`COMMIT;`);
        }).then(() => {
            // get the house
            return this.getHouse(user, id);

        }).then(house => {
            // publish event
            this.eventService?.publishTopic(constants.TOPICS.CONTROL, "house.favorite", {
                "new": {
                    "id": id,
                    "name": house.name
                },
                "user": user
            });
            
            // return the house
            return Promise.resolve(house);

        }).catch((err : Error) => {
            this.dbService!.query(`ROLLBACK;`);
            return Promise.reject(Error(`Unable to set house as favorite: ${err.message}`));
        })
    }
    
    /**
     * Deletes house with supplied ID.
     * 
     * @param user
     * @param id 
     * @throws Error is the house cannot be found if user do not have access to the house
     */
    async deleteHouse(user : LoginUser, {id} : DeleteHouseInput) {
        // validate
        const use_id = id.trim();
        
        // get the house to ensure it exists
        const house = await this.getHouse(user, use_id);

        // delete house
        await this.dbService!.query("delete from house where id=$1", use_id);

        // publish event
        this.eventService?.publishTopic(constants.TOPICS.CONTROL, "house.delete", {
            "old": {
                "id": house.id,
                "name": house.name
            },
            "user": user
        });
    }

    /**
     * Returns all the devices regardless of house but still respecting user access.
     * 
     * @param user
     */
    async getAllDevices(user : LoginUser) : Promise<Device[]> {
        // query to devices
        let result;
        if (this.isAllAccessUser(user)) {
            result = await this.dbService?.query("select d.id deviceid, d.name devicename, d.active deviceactive, d.last_restart, d.last_ping, d.last_watchdog_reset, h.id houseid, h.name housename from device d join house h on d.houseid=h.id order by d.name asc");
        } else {
            result = await this.dbService?.query("select d.id deviceid, d.name devicename, d.active deviceactive, d.last_restart, d.last_ping, d.last_watchdog_reset, h.id houseid, h.name housename from device d, house h, user_house_access u where d.houseid=h.id and h.id=u.houseid and u.userId=$1 order by d.name asc", user.id);
        }
        
        // return house
        const devices = result!.rows.map(row => {
            return {
                "id": row.deviceid,
                "name": row.devicename,
                "lastPing": row.last_ping,
                "lastRestart": row.last_restart,
                "lastWatchdogReset": row.last_watchdog_reset,
                "active": row.deviceactive,
                "house": {
                    "id": row.houseid,
                    "name": row.housename
                }
            } as Device;
        });
        return devices;
    }

    /**
     * Returns the devices for the house with the supplied ID.
     * 
     * @param user
     * @param houseId ID of the house for which you like devices
     * @throws Error if the user do not have access to the house
     */
    async getDevices(user : LoginUser, houseId : string) : Promise<Device[]> {
        // lookup house to ensure it exists and user have access
        const house = await this.getHouse(user, houseId);
        
        // query to devices
        let result;
        if (this.isAllAccessUser(user)) {
            result = await this.dbService?.query("select d.id deviceid, d.name devicename, d.active deviceactive, d.last_restart, d.last_ping, d.last_watchdog_reset, h.id houseid, h.name housename from device d left outer join house h on d.houseid=h.id where h.id=$1 order by d.name asc", houseId);
        } else {
            result = await this.dbService?.query("select d.id deviceid, d.name devicename, d.active deviceactive, d.last_restart, d.last_ping, d.last_watchdog_reset, h.id houseid, h.name housename from device d, house h, user_house_access u where d.houseid=h.id and h.id=u.houseId and h.id=$1 and u.userId=$2 order by d.name asc", houseId, user.id);
        }

        // return house
        const devices = result!.rows.map(row => {
            return {
                "id": row.deviceid,
                "name": row.devicename,
                "lastPing": row.last_ping,
                "lastRestart": row.last_restart,
                "lastWatchdogReset": row.last_watchdog_reset,
                "active": row.deviceactive,
                "house": house
            } as Device;
        });
        return devices;
    }

    /**
     * Returns the device with the supplied ID.
     * 
     * @param user
     * @param deviceId ID of the device
     * @throws If device not found or user do not have access to house of the device
     */
    async getDevice(user : LoginUser, deviceId : string) : Promise<Device> {
        // ensure user have access to the house for the device in question
        let result;
        if (false === this.isAllAccessUser(user)) {
            result = await this.dbService!.query(`select d.id id from device d, house h, user_house_access u where d.id=$2 and d.houseId=h.id and h.id=u.houseId and u.userId=$1`, user.id, deviceId);
            if (result.rowCount !== 1) throw Error(`User (ID ${user.id}) may not have access to house for device (ID ${deviceId})`);
        }

        // get device
        result = await this.dbService!.query("select d.id deviceid, d.name devicename, d.active deviceactive, d.last_restart, d.last_ping, d.last_watchdog_reset, h.id houseid, h.name housename from device d left outer join house h on d.houseid=h.id where d.id=$1", deviceId);
        if (!result || result.rowCount !==1 ) {
            throw Error(`Unable to execute query or unable to find device with ID <${deviceId}>`);
        }

        const row = result.rows[0];
        return {
            "id": row.deviceid, 
            "name": row.devicename,
            "active": row.deviceactive,
            "lastPing": row.last_ping,
            "lastRestart": row.last_restart,
            "lastWatchdogReset": row.last_watchdog_reset,
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
     * @param data Data for device creation
     * @throws Error if the insertion cannot happen or user do not have access to enclosing house
     */
    async createDevice(user : LoginUser, {houseId, id, name, active} : CreateDeviceInput) : Promise<Device> {
        // ensure user have access to house
        if (false === this.isAllAccessUser(user)) {
            const result = await this.dbService!.query("select houseId from user_house_access where houseId=$1 and userId=$2", houseId, user.id);
            if (result.rowCount !== 1) throw Error(`User (ID <${user.id}>) do not have access to house (ID <${houseId}>)`);
        }

        // validate name
        const use_name = name.trim();
        const use_id = id.trim();
        const use_house = houseId.trim();
        
        // try and insert device
        await this.dbService!.query(`insert into device (id, name, active, houseid) values ($1, $2, $3, $4)`, use_id, use_name, active, use_house);

        // publish event
        this.eventService?.publishTopic(constants.TOPICS.CONTROL, "device.create", {
            "new": {
                "id": use_id,
                "name": use_name,
                "active": active
            },
            "user": user
        });

        // return created device
        return this.getDevice(user, use_id);
    }

    /**
     * Updates the device with the supplied name with the supplied name.
     * 
     * @param user Calling user
     * @param data Data for device update
     * @throws Error if device not found or user do not have access to enclosing house
     */
    async updateDevice(user : LoginUser, {id, name, active} : UpdateDeviceInput) {
        // validate
        const use_name = name.trim();
        const use_id = id.trim();

        // get device (this also validates access)
        const device = await this.getDevice(user, use_id);
        
        // attempt to update the device
        const result = await this.dbService?.query("update device set name=$1, active=$3 where id=$2", use_name, use_id, active);
        if (!result || result.rowCount !== 1) {
            throw Error(`Unable to update device with ID <${use_id}>`);
        }

        // publish event
        this.eventService?.publishTopic(constants.TOPICS.CONTROL, "device.update", {
            "new": {
                "id": use_id,
                "name": use_name,
                "active": active
            },
            "old": {
                "id": use_id,
                "name": device.name,
                "active": device.active
            },
            "user": user
        });

        // return
        return this.getDevice(user, use_id);
    }

    /**
     * Deletes the device with the supplied id.
     * 
     * @param user
     * @param data Data for device deletion
     * @throws Error if device cannot be deleted
     */
    async deleteDevice(user : LoginUser, {id} : DeleteDeviceInput) : Promise<void> {
        // validate
        const use_id = id.trim();

        // get device (also validates access to house)
        const device = await this.getDevice(user, use_id);

        // attempt to delete the device
        const result = await this.dbService?.query("delete from device where id=$1", use_id);
        if (!result || result.rowCount !== 1) {
            throw Error(`Unable to delete with ID <${use_id}>`);
        }

        // publish event
        this.eventService?.publishTopic(constants.TOPICS.CONTROL, "device.delete", {
            "old": {
                "id": use_id,
                "name": device.name
            },
            "user": user
        });
    }

    /**
     * Return all sensors the user have access to regardless of which 
     * device it's associated with.
     * 
     * @param user
     * @throws Error if device not found
     */
    async getAllSensors(user : LoginUser) : Promise<Sensor[]> {
        let result;
        if (this.isAllAccessUser(user)) {
            result = await this.dbService!.query("select s.id sensorid, s.name sensorname, s.type sensortype, s.label sensorlabel, s.icon sensoriconv, d.id deviceid, d.name devicename, h.id houseid, h.name housename from sensor s, device d, house h where s.deviceId=d.id and d.houseId=h.id order by s.name asc")
        } else {
            result = await this.dbService!.query("select s.id sensorid, s.name sensorname, s.type sensortype, s.label sensorlabel, s.icon sensoriconv, d.id deviceid, d.name devicename, h.id houseid, h.name housename from sensor s, device d, (select id, name from house h, user_house_access u where h.id=u.houseId and u.userId=$1) h where s.deviceId=d.id and d.houseId=h.id order by s.name asc", user.id);
        }

        // convert and return
        const sensors = convertRowsToSensors(result);
        return sensors;
    }

    /**
     * Return all sensors for device with supplied ID.
     * 
     * @param user
     * @param deviceId ID of device to get sensors for
     * @throws Error if device not found of user do not have access to house id device
     */
    async getSensors(user : LoginUser, deviceId : string) : Promise<Sensor[]> {
        // get device (also validates access)
        const device = await this.getDevice(user, deviceId);

        // query
        const result = await this.dbService!.query("select s.id sensorid, s.name sensorname, s.type sensortype, s.label sensorlabel, s.icon sensoricon, s.scalefactor sensorscalefactor, d.id deviceid, d.name devicename, h.id houseid, h.name housename from sensor s join device d on s.deviceid=d.id left outer join house h on d.houseid=h.id where s.deviceid=$1 order by s.name asc", device.id);

        // convert and return
        const sensors = convertRowsToSensors(result);
        return sensors;
    }

    /**
     * Returns sensor with specified ID
     * 
     * @param user
     * @param sensorId ID of sensor to lookup
     * @throws Error if sensor not found if user do not have access to the enclosing house
     */
    async getSensor(user : LoginUser, sensorId : string) : Promise<Sensor> {
        // trim id
        const use_id = sensorId.trim();

        // get sensor
        let result;
        if (this.isAllAccessUser(user)) {
            result = await this.dbService!.query("select s.id sensorid, s.name sensorname, s.type sensortype, s.icon sensoricon, s.label sensorlabel, s.scalefactor sensorscalefactor, d.id deviceid, d.name devicename, h.id houseid, h.name housename from sensor s, device d, house h where s.deviceId=d.id and d.houseId=h.id and s.id=$1 order by s.name asc", use_id);
        } else {
            result = await this.dbService!.query("select s.id sensorid, s.name sensorname, s.type sensortype, s.icon sensoricon, s.label sensorlabel, s.scalefactor sensorscalefactor, d.id deviceid, d.name devicename, h.id houseid, h.name housename from sensor s, device d, (select id, name from house h, user_house_access u where h.id=u.houseId and u.userId=$1) h where s.deviceId=d.id and d.houseId=h.id and s.id=$2 order by s.name asc", user.id, use_id);
        }
        if (!result || result.rowCount !== 1) {
            throw Error(`Unable to find sensor with ID <${sensorId}>`);
        }

        // return
        const sensors = convertRowsToSensors(result);
        return sensors[0];
    }

    /**
     * Returns sensor with specified ID or undefined if not found.
     * 
     * @param user
     * @param sensorId ID of sensor to lookup
     */
    async getSensorOrUndefined(user : LoginUser, sensorId : string) : Promise<Sensor | undefined> {
        try {
            const s = await this.getSensor(user, sensorId);
            return s;
        } catch (err) {
            return undefined;
        }
    }

    /**
     * Returns sensor with specified label
     * 
     * @param user
     * @param label Label of sensor to lookup
     * @throws Error if sensor not found or user not not have access to enclosing house
     */
    async getSensorByLabel(user : LoginUser, label : string) : Promise<Sensor> {
        // trim 
        const use_label = label.trim();

        // get sensor
        let result;
        if (this.isAllAccessUser(user)) {
            result = await this.dbService!.query("select s.id sensorid, s.name sensorname, s.type sensortype, s.icon sensoricon, s.label sensorlabel, s.scalefactor sensorscalefactor, d.id deviceid, d.name devicename, h.id houseid, h.name housename from sensor s, device d, house h, where s.deviceid=d.id and d.houseid=h.id and s.label=$1 order by s.name asc", use_label);
        } else {
            result = await this.dbService!.query("select s.id sensorid, s.name sensorname, s.type sensortype, s.icon sensoricon, s.label sensorlabel, s.scalefactor sensorscalefactor, d.id deviceid, d.name devicename, h.id houseid, h.name housename from sensor s, device d, (select id, name from house h, user_house_access u where h.id=u.houseId and u.userId=$1) h where s.deviceid=d.id and d.houseid=h.id and s.label=$2 order by s.name asc", user.id, use_label);
        }
        if (!result || result.rowCount !== 1) {
            throw Error(`Unable to find sensor with label <${label}> or user do not have access`);
        }

        // return
        const sensors = convertRowsToSensors(result);
        return sensors[0];
    }

    /**
     * Creates a sensor on the specified device.
     * 
     * @param user 
     * @param data
     * @throws Error if the user do not have access to the enclosing house or sensor id not unique
     */
    async createSensor(user : LoginUser, {deviceId, id, name, label, type, icon, scaleFactor} : CreateSensorType) : Promise<Sensor> {
        // validate 
        const use_id = id.trim();
        const use_name = name.trim();
        const use_label = label.trim();
        
        // get device to ensure it exists and user have accesss
        await this.getDevice(user, deviceId);

        // create sensor
        await this.dbService!.query(`insert into sensor (deviceid, id, name, label, type, icon, scalefactor) values ($1, $2, $3, $4, $5, $6, $7)`, deviceId, use_id, use_name, use_label, type, icon, scaleFactor);

        // get sensor
        const sensor = await this.getSensor(user, use_id);

        // publish event
        this.eventService?.publishTopic(constants.TOPICS.CONTROL, "sensor.create", {
            "new": {
                "deviceId": deviceId,
                "id": use_id,
                "name": use_name,
                "label": use_label,
                "type": type,
                "icon": icon,
                "scaleFactor": scaleFactor
            },
            "user": user
        });

        // return
        return sensor;
    }

    /**
     * Updates the specified sensor.
     * 
     * @param user 
     * @param param1 
     * @throws Error if sensor not found or user do not have access to enclosing house
     */
    async updateSensor(user : LoginUser, {id, name, label, type, icon, scaleFactor} : UpdateSensorType) : Promise<Sensor> {
        // validate
        const use_id = id.trim();
        const use_name = name.trim();
        const use_label = label.trim();
        
        // get sensor (also validates access)
        const sensor = await this.getSensor(user, use_id);

        // update sensor
        const result = await this.dbService?.query("update sensor set name=$1, label=$2, type=$3, icon=$5, scalefactor=$6 where id=$4", use_name, use_label, type, use_id, icon, scaleFactor);
        if (!result || result.rowCount !== 1) {
            throw Error(`Unable to update sensor with ID <${use_id}>`);
        }

        // publish event
        this.eventService?.publishTopic(constants.TOPICS.CONTROL, "sensor.update", {
            "new": {
                "deviceId": sensor.deviceId,
                "name": use_name,
                "label": use_label,
                "type": type,
                "icon": icon,
                "scaleFactor": scaleFactor
            },
            "old": {
                "deviceId": sensor.deviceId,
                "id": use_id,
                "name": sensor.name,
                "label": sensor.label,
                "type": sensor.type,
                "icon": sensor.icon,
                "scaleFactor": sensor.scaleFactor
            },
            "user": user
        });

        // return
        return this.getSensor(user, use_id);

    }

    /**
     * Deletes the specified sensor.
     * 
     * @param user 
     * @param param1 
     * @throws Error if sensor not found or user do not have access to enclosing house
     */
    async deleteSensor(user : LoginUser, {id} : DeleteSensorType) : Promise<void> {
        // validate
        const use_id = id.trim();

        // get sensor (also validates access)
        const sensor = await this.getSensor(user, use_id);

        // delete the sensor
        await this.dbService?.query("delete from sensor where id=$1", use_id);
        
        // publish event
        this.eventService?.publishTopic(constants.TOPICS.CONTROL, "sensor.delete", {
            "old": {
                "deviceId": sensor.deviceId,
                "id": use_id,
                "name": sensor.name,
                "label": sensor.label,
                "type": sensor.type,
                "scaleFactor": sensor.scaleFactor
            },
            "user": user
        });
    }

    /**
     * Returns the sensors marked as favorite for the supplied user.
     * 
     * @param user 
     */
    async getFavoriteSensors(user : LoginUser) {
        const result = await this.dbService!.query("select s.id sensorid, s.name sensorname, s.type sensortype, s.icon sensoricon, s.label sensorlabel, s.scalefactor sensorscalefactor, d.id deviceid, d.name devicename, h.id houseid, h.name housename from sensor s, device d, (select id, name from house h, user_house_access u where h.id=u.houseId and u.userId=$1) h where s.deviceid=d.id and d.houseid=h.id and s.id in (select sensorId from favorite_sensor where userId=$1) order by s.name asc", user.id);
        const sensors = convertRowsToSensors(result);
        return sensors;
    }

    /**
     * Adds the sensor with the supplied ID as a favorite sensor.
     * 
     * @param user 
     * @param id
     */
    async addFavoriteSensor(user : LoginUser, id : string) {
        await this.dbService!.query("insert into favorite_sensor (userId, sensorId) values ($1, $2) on conflict do nothing", user.id, id);
    }

    /**
     * Removes the sensor with the supplied ID as a favorite sensor.
     * 
     * @param user 
     * @param id
     */
    async removeFavoriteSensor(user : LoginUser, id : string) {
        await this.dbService!.query("delete from favorite_sensor where userId=$1 and sensorId=$2", user.id, id);
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

    /**
     * Returns the device watchdog configuration for the supplied user and device 
     * or default values if not configured.
     * @param user 
     * @param deviceId 
     */
    async getDeviceWatchdog(user : LoginUser, deviceId : string) {
        // get device to ensure access
        await this.getDevice(user, deviceId);

        // get watchdogs
        const result = await this.dbService!.query("select notify, muted_until from device_watchdog where userId=$1 and deviceId=$2", user.id, deviceId);
        if (result.rowCount === 0) {
            return {
                "notify": WatchdogNotification.no,
                "mutedUntil": undefined
            } as DeviceWatchdog;
        } else {
            const row = result.rows[0];
            return {
                "notify": row.notify as WatchdogNotification,
                "mutedUntil": row.muted_until ? moment.utc(row.muted_until).toDate() : undefined
            } as DeviceWatchdog;
        }
    }

    async updateDeviceWatchdog(user : LoginUser, data : WatchdogNotificationInput, mutedUntil? : Moment.Moment) {
        // get device to ensure user have access
        await this.getDevice(user, data.id);

        // get params
        if (data.notify === WatchdogNotification.muted && !mutedUntil) {
            mutedUntil = moment().add(7, "days");
        }
        let str_muted_until = data.notify === WatchdogNotification.muted ? mutedUntil?.toISOString() : undefined;
        
        let result = await this.dbService!.query("select userId, deviceId from device_watchdog where userId=$1 AND deviceId=$2", user.id, data.id);
        if (!result || result.rowCount === 0) {
            // insert
            result = await this.dbService!.query("insert into device_watchdog (notify, muted_until, userId, deviceId) values ($1, $2, $3, $4)", data.notify, str_muted_until, user.id, data.id);
        } else {
            // update
            result = await this.dbService!.query("update device_watchdog set notify=$1, muted_until=$2 where userId=$3 AND deviceId=$4", data.notify, str_muted_until, user.id, data.id);
        }
    }

    /**
     * Returns the settings to the supplied user.
     * 
     * @param user 
     */
    async settings(user : LoginUser) : Promise<NotificationSettings> {
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

    /**
     * Updates the settings for the user. 
     * @param user 
     * @param data 
     */
    async updateSettings(user : LoginUser, data : UpdateSettingsInput) : Promise<void> {
        await this.dbService!.query("update login_user set default_notify_using=$1, pushover_apptoken=$2, pushover_userkey=$3 where id=$4", data.notify_using, data.pushover_apptoken, data.pushover_userkey, user.id);
    }
    
    /**
     * Returns last N number of samples read from the database for the sensor with the 
     * supplied ID.
     * 
     * @param sensorId 
     * @param samples 
     */
    async getLastNSamplesForSensor(user : LoginUser, sensorId : string, samples : number = 100) : Promise<SensorSample[] | undefined> {
        // get sensor to validate access
        await this.getSensor(user, sensorId);

        // get data
        return this.dbService!.query(`select sd.value as value, sd.dt dt, case when s.scalefactor is null then 1 else s.scalefactor end from sensor_data sd left outer join sensor s on sd.id=s.id where sd.id='${sensorId}' order by dt desc limit ${samples}`).then(result => {
            const arr = result.rows.map(row => {
                return {
                    "id": sensorId,
                    "dt": row.dt,
                    "value": row.value * row.scalefactor
                } as SensorSample;
            })
            return Promise.resolve(arr);
        })
    }

    /**
     * Persist powermeter sample.
     * 
     * @param sample 
     */
    async persistPowermeterReading(sample : Smartme.DeviceSample) {
        this.dbService!.query(`insert into powermeter_data (
            id, 
            dt, 
            ActiveEnergyTotalExport, 
            ActiveEnergyTotalImport, 
            ActivePowerPhaseL1, 
            ActivePowerPhaseL2, 
            ActivePowerPhaseL3, 
            ActivePowerTotal, 
            CurrentPhaseL1, 
            CurrentPhaseL2, 
            CurrentPhaseL3, 
            VoltagePhaseL1, 
            VoltagePhaseL2, 
            VoltagePhaseL3) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`, 
            sample.deviceId, 
            sample.dt.toISOString(), 
            sample.getValue(Smartme.Obis.ActiveEnergyTotalExport), 
            sample.getValue(Smartme.Obis.ActiveEnergyTotalImport),
            sample.getValue(Smartme.Obis.ActivePowerPhaseL1),
            sample.getValue(Smartme.Obis.ActivePowerPhaseL2),
            sample.getValue(Smartme.Obis.ActivePowerPhaseL3),
            sample.getValue(Smartme.Obis.ActivePowerTotal),
            sample.getValue(Smartme.Obis.CurrentPhaseL1),
            sample.getValue(Smartme.Obis.CurrentPhaseL2),
            sample.getValue(Smartme.Obis.CurrentPhaseL3),
            sample.getValue(Smartme.Obis.VoltagePhaseL1),
            sample.getValue(Smartme.Obis.VoltagePhaseL2),
            sample.getValue(Smartme.Obis.VoltagePhaseL3));
    }

    private isAllAccessUser(user : LoginUser) {
        return user.houseId === "*";
    }
}

