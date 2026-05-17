import { QueryResult } from "pg";
import { v1 as uuid } from "uuid";
import constants from "../constants";
import { Logger } from "../logger";
import { CreateDeviceInput, UpdateDeviceInput } from "../resolvers/device";
import { CreateHouseInput, FavoriteHouseInput, House, UpdateHouseInput } from "../resolvers/house";
import { CreateSensorType, DeleteSensorType, FavoriteSensorsInput, UpdateSensorType } from "../resolvers/sensor";
import {
    BackendIdentity, BaseService, DataElement, Device, DeviceData, CalloutEndpoint, EventActionType, EventDefinition, EventTriggerType, getContentType, getHttpMethod, HouseUser, HttpMethod, InitCallback, NullableBoolean, OnSensorSampleEvent, PowerPhase, PowerType, CalloutSecret, Sensor,
    SensorSample, SensorType, TokenIssuerInformation, UserPrincipal,
    CalloutAuthenticator,
    Callout,
    CronJob,
    CronJobType
} from "../types";
import { DatabaseService } from "./database-service";
import { PubsubService } from "./pubsub-service";
import { RedisService } from "./redis-service";
import moment = require("moment");
import { SmartmeDeviceWithDataType } from "../resolvers/smartme";
import { lookupService } from "../configure-services";
import { ISO8601_DATETIME_FORMAT } from "../constants";
import { IdentityService } from "./identity-service";
import { CreateCalloutEndpointInput, UpdateCalloutEndpointInput, DeleteCalloutEndpointInput } from "../resolvers/callout-endpoint";
import { CreateOnSensorSampleEventInput, UpdateOnSensorSampleEventInput } from "../resolvers/event";
import { CreateCalloutSecretInput, DeleteCalloutSecretInput, UpdateCalloutSecretInput } from "../resolvers/callout-secret";
import { DeleteInput } from "../resolvers/common";
import { AuthenticatorTemplate, DATACLOUD_CLIENTCREDENTIALS, DATACLOUD_WEBSDK, STATIC_BEARERTOKEN, CLIENTCREDENTIALS_OAUTH, templates } from "../callout-authenticator-templates/templates";
import { CreateCalloutAuthenticatorInput, UpdateCalloutAuthenticatorInput } from "../resolvers/callout-authenticator";

const DEVICE_DATA_KEY_PREFIX = "device_data:";
const HOUSE_COLUMNS = "h.id houseid, h.name housename";
const DEVICE_COLUMNS = "d.id deviceid, d.name devicename, d.active deviceactive, d.last_restart, d.last_ping, d.timeout_seconds device_timeout_seconds";
const SENSOR_COLUMNS =
    "s.id sensorid, s.name sensorname, s.type sensortype, s.icon sensoricon, s.label sensorlabel, s.scalefactor sensorscalefactor, s.timeout_seconds sensor_timeout_seconds";
const logger = new Logger("storage-service");

/**
 * serial executes Promises sequentially.
 * @param {funcs} An array of funcs that return promises.
 * @example
 * const urls = ['/url1', '/url2', '/url3']
 * serial(urls.map(url => () => $.ajax(url)))
 *     .then(console.log.bind(console))
 */
const serial = (funcs : (() => Promise<any>)[]) => {
    const concat = (list : any) => Array.prototype.concat.bind(list)
    const promiseConcat = (f : any) => (x : any) => f().then(concat(x))
    const promiseReduce = (acc : any, x : any) => acc.then(promiseConcat(x))
    return funcs.reduce(promiseReduce, Promise.resolve([]))
}

/**
 * Converts sensors from the query result to an array of sensors
 * @param result 
 */
const convertRowsToSensors = (result : QueryResult) => {
    return result.rows.map(row => {
        return {
            "id": row.sensorid,
            "deviceId": row.deviceid,
            "name": row.sensorname,
            "label": row.sensorlabel,
            "type": row.sensortype as string,
            "icon": row.sensoricon,
            "scaleFactor": row.sensorscalefactor,
            "timeoutSeconds": row.sensor_timeout_seconds || undefined,
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
const convertRowsToDevices = (result : QueryResult) => {
    return result.rows.map((row) => {
        return {
            id: row.deviceid,
            name: row.devicename,
            lastPing: row.last_ping,
            lastRestart: row.last_restart,
            active: row.deviceactive,
            timeoutSeconds: row.device_timeout_seconds || undefined,
            house: {
                id: row.houseid,
                name: row.housename,
            },
        } as Device;
    });
}

export interface SensorQueryData {
    deviceId? : string;
    sensorIds? : Array<string>,
    type? : SensorType;
    label? : string;
    houseId? : string;
    favorite?: NullableBoolean;
}

const POWERDATA_REDIS_KEY = "powerdata:";
export const LAST_N_SAMPLES = 100;

export class StorageService extends BaseService {
    public static NAME = "storage";
    dbService!: DatabaseService;
    eventService!: PubsubService;
    redisService!: RedisService;

    constructor() {
        super(StorageService.NAME);
        this.dependencies = [DatabaseService.NAME, PubsubService.NAME, RedisService.NAME];
    }

    init(callback: InitCallback, services: BaseService[]) {
        this.dbService = services[0] as unknown as DatabaseService;
        this.eventService = services[1] as unknown as PubsubService;
        this.redisService = services[2] as unknown as RedisService;

        // did init
        callback();
    }

    /**
     * Find user in the database by our interal id or email.
     * @param user
     * @param userIdOrEmail
     */
    //@ts-ignore
    async getUser(user: BackendIdentity, id: string): Promise<UserPrincipal> {
        const result = await this.dbService.query(
            "select id, email, fn, ln from login_user where id=$1 OR email=$2",
            id,
            id
        );
        if (!result || result.rowCount !== 1) {
            throw Error(`Unable to find user by Google subject, ID or email (<${id}>)`);
        }
        const obj = new UserPrincipal(result.rows[0].id, result.rows[0].fn, result.rows[0].ln, result.rows[0].email);
        return obj;
    }

    /**
     * Loads data from the powermeter_data table.
     *
     * @param user
     * @param id
     * @param start
     * @param end
     * @param type
     * @param phase
     * @returns
     */
    async getPowerPhaseData(
        user: BackendIdentity,
        id: string,
        start: Date,
        end: Date,
        type: PowerType,
        phase: PowerPhase
    ): Promise<SensorSample[]> {
        // get the sensor to ensure access
        const sensor = await this.getSensor(user, id);
        logger.debug(`Retrieved sensor with id <${sensor.id}> and name <${sensor.name}>`);

        // get data
        const columnNullTest = "currentphasel1";
        const getColumn = (type: PowerType, phase: PowerPhase) => {
            const columnBase = type === "voltage" ? "voltagephase" : type === "current" ? "currentphase" : undefined;
            if (!columnBase) throw new Error(`Unknown type supplied (${type})`);
            const phaseNo = phase === PowerPhase.l1 ? 1 : phase === PowerPhase.l2 ? 2 : 3;
            const column = `${columnBase}l${phaseNo}`;
            return column;
        };
        const query = (() => {
            if (type === PowerType.power) {
                const columnCurrent = getColumn(PowerType.current, phase);
                const columnVoltage = getColumn(PowerType.voltage, phase);
                return `select dt, ${columnCurrent}*${columnVoltage} as value from powermeter_data where dt >= $2 and dt < $3 and id=$1 and not ${columnNullTest} is null order by dt desc;`;
            } else {
                return `select dt, ${getColumn(
                    type,
                    phase
                )} as value from powermeter_data where dt >= $2 and dt < $3 and id=$1 and not ${columnNullTest} is null order by dt desc;`;
            }
        })();
        const result = await this.dbService.query(query, id, start, end);

        // create samples
        const samples = result.rows.map((row) => {
            return {
                dt: row.dt,
                value: row.value,
                id: id,
            } as SensorSample;
        });
        return samples;
    }

    /**
     * Try and lookup power price data in cache.
     * @param key
     */
    async getPowerPriceData(key: string): Promise<DataElement[] | undefined> {
        const data = await this.redisService!.get(`${POWERDATA_REDIS_KEY}${key}`);
        if (data) {
            // keep data a little longer in cache as it was accessed
            this.redisService!.expire(
                `${POWERDATA_REDIS_KEY}${key}`,
                constants.DEFAULTS.REDIS.POWERDATA_EXPIRATION_SECS
            );

            // parse and return
            return JSON.parse(data) as DataElement[];
        } else {
            return undefined;
        }
    }

    /**
     * Set powerdata in cache.
     * @param key
     * @param data
     */
    async setPowerPriceData(key: string, data: DataElement[]) {
        const str = JSON.stringify(data);
        await this.redisService!.setex(
            `${POWERDATA_REDIS_KEY}${key}`,
            constants.DEFAULTS.REDIS.POWERDATA_EXPIRATION_SECS,
            str
        );
        logger.debug(`Stored power price data in cache with key <${key}>`);
    }

    /**
     * Set/update device data from the device in cache.
     *
     * @param deviceId
     * @param data
     */
    async setDeviceData(deviceId: string, data: any) {
        const obj = {
            dt: moment.utc().format(ISO8601_DATETIME_FORMAT),
            data,
        };
        this.redisService!.set(`${DEVICE_DATA_KEY_PREFIX}${deviceId}`, JSON.stringify(obj));
    }

    /**
     * Returns any device data from the device in cache.
     *
     * @param deviceId
     */
    async getDeviceData(deviceId: string): Promise<DeviceData | undefined> {
        const str_data = await this.redisService!.get(`${DEVICE_DATA_KEY_PREFIX}${deviceId}`);
        if (str_data) {
            const obj = JSON.parse(str_data);
            obj.str_dt = obj.dt;
            obj.dt = moment.utc(obj.dt, ISO8601_DATETIME_FORMAT);
            return obj;
        }
        return undefined;
    }

    /**
     * Store temporary data in redis with the supplied TTL.
     *
     * @param key
     * @param ttl
     * @param data
     */
    async setTemporaryData(key: string, ttl: number, data: Buffer) {
        this.redisService!.setex(key, ttl, data);
    }

    /**
     * Get temporary data out of Redis.
     *
     * @param key
     */
    async getTemporaryData(key: string): Promise<Buffer | null> {
        const buf = await this.redisService!.getBuffer(key);
        return buf;
    }

    /**
     * Returns the house with the supplied ID.
     *
     * @param houseid ID of the house to return
     * @throws Error is house not found or calling user do not have access to the house
     */
    async getHouse(user: BackendIdentity, houseid: string): Promise<House> {
        let result;
        if (this.isAllHousesAccessUser(user)) {
            result = await this.dbService.query(`select id, name from house h where h.id=$1`, houseid);
            if (result.rowCount !== 1) throw Error(`Unable to find a single House with ID <${houseid}>`);
        } else {
            result = await this.dbService.query(
                `select id, name from house h, user_house_access u where h.id=u.houseId and u.houseId=$2 and u.userId=$1`,
                this.getUserIdFromUser(user),
                houseid
            );
            if (result.rowCount !== 1)
                throw Error(`Unable to find a single House with ID or the user do not have access <${houseid}>`);
        }

        // create house
        const row = result.rows[0];
        return {
            id: row.id,
            name: row.name,
        } as House;
    }

    /**
     * Returns all the houses.
     *
     * @param user
     */
    async getHouses(user: BackendIdentity): Promise<House[]> {
        let result;
        if (this.isAllHousesAccessUser(user)) {
            result = await this.dbService.query("select id, name from house h order by name asc");
        } else if (this.ensureScope(user, constants.JWT.SCOPE_READ)) {
            result = await this.dbService.query(
                "select id, name from house h, user_house_access u where u.userId=$1 and h.id=u.houseId order by name asc",
                this.getUserIdFromUser(user)
            );
        } else {
            throw Error("User does not have access to read data");
        }

        // map to houses
        return result.rows.map((row) => {
            return {
                id: row.id,
                name: row.name,
            };
        }) as House[];
    }

    /**
     * Returns the houses for the supplied user ID.
     * @param user
     * @param userId
     * @throws Error if called by non service principal
     */
    async getHousesForUser(user: BackendIdentity, userId: string): Promise<House[]> {
        // get impersonation user
        const identity = (await lookupService(IdentityService.NAME)) as IdentityService;
        const impUser = identity.getImpersonationIdentity(user, userId);
        return this.getHouses(impUser);
    }

    /**
     * Creates the house with the supplied name,
     *
     * @param user User owning the house
     * @param data Name of the house
     */
    async createHouse(user: BackendIdentity, { name }: CreateHouseInput): Promise<House> {
        // validate name
        const use_name = name.trim();

        // generate id
        const house_id = uuid();

        // ensure unqiue name
        const houses = await this.getHouses(user);
        const houseWithSameName = houses.filter((h) => h.name === name.trim());
        if (houseWithSameName.length !== 0) {
            // found house with same name
            throw Error(`House with that name (${use_name}) already exists`);
        }

        // insert house row
        return this.dbService
            .query("BEGIN")
            .then(() => {
                return this.dbService.query("insert into house (id, name) values ($1, $2)", house_id, use_name);
            })
            .then(() => {
                return this.dbService.query(
                    "insert into user_house_access (userId, houseId, owner) values ($1, $2, TRUE)",
                    this.getUserIdFromUser(user),
                    house_id
                );
            })
            .then(() => {
                return this.dbService.query("COMMIT");
            })
            .then(() => {
                // publish event
                this.eventService.publish(`${constants.TOPICS.CONTROL}.house.create`, {
                    new: {
                        id: house_id,
                        name: use_name,
                    },
                    user: user,
                });
            })
            .then(() => {
                return this.getHouse(user, house_id);
            })
            .catch((err) => {
                logger.warn(`Unable to create house due to error: ${err.message}`);
                return this.dbService.query("ROLLBACK").then(() => {
                    return Promise.reject(Error(`Unable to create house due to error (${err.message})`));
                });
            });
    }

    /**
     * Updates the house with the supplied ID setting the name
     *
     * @param user
     * @param id ID of house to update
     * @param name New name of house
     * @throws Error is house cannot be found or user do not have access to the house
     */
    async updateHouse(user: BackendIdentity, { id, name }: UpdateHouseInput): Promise<House> {
        // validate
        const use_id = id.trim();
        const use_name = name.trim();

        // get house
        const house = await this.getHouse(user, use_id);

        // update house
        const result = await this.dbService.query(`update house set name=$1 where id=$2`, use_name, use_id);
        if (!result || result.rowCount !== 1) {
            throw Error(`Unable to update house with ID <${use_id}>`);
        }

        // publish event
        this.eventService.publish(`${constants.TOPICS.CONTROL}.house.update`, {
            new: {
                id: use_id,
                name: use_name,
            },
            old: {
                id: house.id,
                name: house.name,
            },
            user: user,
        });

        // return the house
        return this.getHouse(user, use_id);
    }

    /**
     * Favorites the supplied house for the user.
     *
     * @param user
     * @param data
     */
    async getFavoriteHouse(user: BackendIdentity): Promise<House | undefined> {
        const result = await this.dbService.query(
            "select id, name from house h, user_house_access u where h.id=u.houseId and u.userId=$1 and u.is_default=true",
            this.getUserIdFromUser(user)
        );
        if (result.rowCount !== 1) return undefined;
        return {
            id: result.rows[0].id,
            name: result.rows[0].name,
        } as House;
    }

    /**
     * Returns true if the userId is the owner of the house with houseId
     * @param user
     * @param userId
     * @param houseId
     */
    async isHouseOwner(user: BackendIdentity, userId: string, houseId: string): Promise<boolean> {
        // ensure access
        const house = await this.getHouse(user, houseId);
        const result = await this.dbService.query(
            "select owner from user_house_access where userId=$1 and houseId=$2",
            userId,
            house.id
        );
        if (!result || result.rowCount !== 1) {
            throw Error(`User (ID <${userId}>) does not have access to the house (ID <${houseId}>)`);
        }
        return result.rows[0].owner;
    }

    /**
     *
     * @param user
     * @param houseId
     */
    async getHouseUsers(user: BackendIdentity, houseId: string): Promise<HouseUser[]> {
        // ensure access to house
        const house = await this.getHouse(user, houseId);
        const result = await this.dbService.query(
            "select id, fn, ln, email, u.owner owner from login_user l, user_house_access u where l.id=u.userId and u.houseId=$1",
            house.id
        );
        if (!result || result.rowCount === 0) return [];
        return result?.rows.map((r) => new HouseUser(r.id, r.fn, r.ln, r.email, r.owner));
    }

    /**
     * Favorites the supplied house for the user.
     *
     * @param user
     * @param data
     */
    async setFavoriteHouse(user: BackendIdentity, { id }: FavoriteHouseInput): Promise<House> {
        return this.dbService
            .query(`BEGIN;`)
            .then(() => {
                return this.dbService.query(
                    "select userId, houseId, is_default from user_house_access where userId=$1 and houseId=$2",
                    this.getUserIdFromUser(user),
                    id
                );
            })
            .then((result) => {
                if (result.rowCount !== 1) {
                    // user do not have access
                    return Promise.reject(Error("User trying to favorite a house they do not have access to"));
                }

                // mark all user houses as not-default
                return this.dbService.query(
                    `update user_house_access set is_default=false WHERE userId=$1`,
                    this.getUserIdFromUser(user)
                );
            })
            .then(() => {
                return this.dbService.query(
                    `update user_house_access set is_default=true where userId=$1 and houseId=$2;`,
                    this.getUserIdFromUser(user),
                    id
                );
            })
            .then(() => {
                return this.dbService.query(`COMMIT;`);
            })
            .then(() => {
                // get the house
                return this.getHouse(user, id);
            })
            .then((house) => {
                // publish event
                this.eventService.publish(`${constants.TOPICS.CONTROL}.house.favorite`, {
                    new: {
                        id: id,
                        name: house.name,
                    },
                    user: user,
                });

                // return the house
                return Promise.resolve(house);
            })
            .catch((err: Error) => {
                this.dbService.query(`ROLLBACK;`);
                return Promise.reject(Error(`Unable to set house as favorite: ${err.message}`));
            });
    }

    async grantHouseAccess(user: BackendIdentity, houseId: string, userId: string | Array<string>): Promise<boolean> {
        // get house to ensure access
        const house = await this.getHouse(user, houseId);

        return this.dbService
            .query("BEGIN")
            .then(() => {
                return serial(
                    (Array.isArray(userId) ? userId : [userId]).map((uid) => () => {
                        return this.dbService.query(
                            "insert into user_house_access (userId, houseId) values ($1, $2) on conflict do nothing",
                            uid,
                            house.id
                        );
                    })
                );
            })
            .then(() => {
                return this.dbService.query("COMMIT");
            })
            .then(() => {
                return Promise.resolve(true);
            })
            .catch((err) => {
                return this.dbService.query("ROLLBACK").then(() => {
                    return Promise.reject(Error(`Unable to grant access for users to house (${err.message})`));
                });
            });
    }

    async revokeHouseAccess(user: BackendIdentity, houseId: string, userId: string | Array<string>): Promise<boolean> {
        // get house to ensure access
        const house = await this.getHouse(user, houseId);
        return this.dbService
            .query("BEGIN")
            .then(() => {
                return serial(
                    (Array.isArray(userId) ? userId : [userId]).map((uid) => () => {
                        return this.dbService.query(
                            "delete from user_house_access where userId=$1 and houseId=$2 and owner=false",
                            uid,
                            house.id
                        );
                    })
                );
            })
            .then(() => {
                return this.dbService.query("select count(*) count from user_house_access where houseId=$1", house.id);
            })
            .then((result) => {
                if (result.rows[0].count === 0) {
                    // cannot remove all access
                    return Promise.reject(Error("Cannot delete last user with access to house"));
                }
                return this.dbService.query("COMMIT");
            })
            .then(() => {
                return Promise.resolve(true);
            })
            .catch((err) => {
                return this.dbService.query("ROLLBACK").then(() => {
                    return Promise.reject(err);
                });
            });
    }

    /**
     * Deletes house with supplied ID.
     *
     * @param user
     * @param id
     * @throws Error is the house cannot be found if user do not have access to the house
     */
    async deleteHouse(user: BackendIdentity, { id }: DeleteInput) {
        // validate
        const use_id = id.trim();

        // get the house to ensure it exists
        const house = await this.getHouse(user, use_id);

        // delete house
        await this.dbService.query("delete from house where id=$1", use_id);

        // publish event
        this.eventService.publish(`${constants.TOPICS.CONTROL}.house.delete`, {
            old: {
                id: house.id,
                name: house.name,
            },
            user: user,
        });
    }

    /**
     * Returns all the devices regardless of house but still respecting user access.
     *
     * @param user
     */
    async getAllDevices(user: BackendIdentity): Promise<Device[]> {
        // query to devices
        let result;
        if (this.isAllDataAccessUser(user)) {
            result = await this.dbService.query(
                `select ${DEVICE_COLUMNS}, ${HOUSE_COLUMNS} from device d join house h on d.houseid=h.id order by d.name asc`
            );
        } else {
            result = await this.dbService.query(
                `select ${DEVICE_COLUMNS}, ${HOUSE_COLUMNS} from device d, house h, user_house_access u where d.houseid=h.id and h.id=u.houseid and u.userId=$1 order by d.name asc`,
                this.getUserIdFromUser(user)
            );
        }

        // return devices
        const devices = convertRowsToDevices(result);
        return devices;
    }

    /**
     * Returns the devices for the house with the supplied ID.
     *
     * @param user
     * @param houseId ID of the house for which you like devices
     * @throws Error if the user do not have access to the house
     */
    async getDevices(user: BackendIdentity, houseId: string): Promise<Device[]> {
        // lookup house to ensure it exists and user have access
        await this.getHouse(user, houseId);

        // query to devices
        let result;
        if (this.isAllDataAccessUser(user)) {
            result = await this.dbService.query(
                `select ${DEVICE_COLUMNS}, ${HOUSE_COLUMNS} from device d left outer join house h on d.houseid=h.id where h.id=$1 order by d.name asc`,
                houseId
            );
        } else {
            result = await this.dbService.query(
                `select ${DEVICE_COLUMNS}, ${HOUSE_COLUMNS} from device d, house h, user_house_access u where d.houseid=h.id and h.id=u.houseId and h.id=$1 and u.userId=$2 order by d.name asc`,
                houseId,
                this.getUserIdFromUser(user)
            );
        }

        // return house
        const devices = convertRowsToDevices(result);
        return devices;
    }

    /**
     * Returns the device with the supplied ID.
     *
     * @param user
     * @param deviceId ID of the device
     * @throws If device not found or user do not have access to house of the device
     */
    async getDevice(user: BackendIdentity, deviceId: string): Promise<Device> {
        // ensure user have access to the house for the device in question
        let result;
        if (false === this.isAllDataAccessUser(user)) {
            result = await this.dbService.query(
                `select d.id id from device d, house h, user_house_access u where d.id=$2 and d.houseId=h.id and h.id=u.houseId and u.userId=$1`,
                this.getUserIdFromUser(user),
                deviceId
            );
            if (result.rowCount !== 1)
                throw Error(`User (${user}) may not have access to house for device (ID ${deviceId})`);
        }

        // get device
        result = await this.dbService.query(
            `select ${DEVICE_COLUMNS}, ${HOUSE_COLUMNS} from device d left outer join house h on d.houseid=h.id where d.id=$1`,
            deviceId
        );
        if (!result || result.rowCount !== 1) {
            throw Error(`Unable to execute query or unable to find device with ID <${deviceId}>`);
        }

        return convertRowsToDevices(result)[0];
    }

    /**
     * Creates device in the database and returns the device. The ID of the device
     * must be unique i the database.
     *
     * @param houseid ID of the house the device belongs to
     * @param data Data for device creation
     * @throws Error if the insertion cannot happen or user do not have access to enclosing house
     */
    async createDevice(user: BackendIdentity, { houseId, id, name, active }: CreateDeviceInput): Promise<Device> {
        // ensure user have access to house
        if (false === this.isAllDataAccessUser(user)) {
            const result = await this.dbService.query(
                "select houseId from user_house_access where houseId=$1 and userId=$2",
                houseId,
                this.getUserIdFromUser(user)
            );
            if (result.rowCount !== 1) throw Error(`User (ID <${user}>) do not have access to house (ID <${houseId}>)`);
        }

        // validate name
        const use_name = name.trim();
        const use_id = id.trim();
        const use_house = houseId.trim();

        // try and insert device
        await this.dbService.query(
            `insert into device (id, name, active, houseid) values ($1, $2, $3, $4)`,
            use_id,
            use_name,
            active,
            use_house
        );

        // publish event
        this.eventService.publish(`${constants.TOPICS.CONTROL}.device.create`, {
            new: {
                id: use_id,
                name: use_name,
                active: active,
            },
            user: user,
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
    async updateDevice(user: BackendIdentity, { id, name, active, timeoutSeconds }: UpdateDeviceInput) {
        // validate
        const use_name = name.trim();
        const use_id = id.trim();

        // get device (this also validates access)
        const device = await this.getDevice(user, use_id);

        // attempt to update the device
        const result = await this.dbService.query(
            "update device set name=$1, active=$3, timeout_seconds=$4 where id=$2",
            use_name,
            use_id,
            active,
            timeoutSeconds !== undefined ? timeoutSeconds : null
        );
        if (!result || result.rowCount !== 1) {
            throw Error(`Unable to update device with ID <${use_id}>`);
        }

        // publish event
        this.eventService.publish(`${constants.TOPICS.CONTROL}.device.update`, {
            new: {
                id: use_id,
                name: use_name,
                active: active,
                timeoutSeconds: timeoutSeconds,
            },
            old: {
                id: use_id,
                name: device.name,
                active: device.active,
                timeoutSeconds: device.timeoutSeconds,
            },
            user: user,
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
    async deleteDevice(user: BackendIdentity, { id }: DeleteInput): Promise<void> {
        // validate
        const use_id = id.trim();

        // get device (also validates access to house)
        const device = await this.getDevice(user, use_id);

        // attempt to delete the device
        const result = await this.dbService.query("delete from device where id=$1", use_id);
        if (!result || result.rowCount !== 1) {
            throw Error(`Unable to delete with ID <${use_id}>`);
        }

        // publish event
        this.eventService.publish(`${constants.TOPICS.CONTROL}.device.delete`, {
            old: {
                id: use_id,
                name: device.name,
            },
            user: user,
        });
    }

    /**
     * Return all sensors for device with supplied ID.
     *
     * @param user
     * @param deviceId ID of device to get sensors for
     * @throws Error if device not found of user do not have access to house id device
     */
    async getSensors(user: BackendIdentity, queryData?: SensorQueryData): Promise<Sensor[]> {
        let result;
        if (this.isAllDataAccessUser(user)) {
            result = await this.dbService.query(
                `select ${SENSOR_COLUMNS}, ${DEVICE_COLUMNS}, ${HOUSE_COLUMNS} from sensor s, device d, house h where s.deviceId=d.id and d.houseId=h.id order by s.name asc`
            );
        } else {
            result = await this.dbService.query(
                `select ${SENSOR_COLUMNS}, ${DEVICE_COLUMNS}, ${HOUSE_COLUMNS} from sensor s, device d, (select id, name from house h, user_house_access u where h.id=u.houseId and u.userId=$1) h where s.deviceId=d.id and d.houseId=h.id order by s.name asc`,
                this.getUserIdFromUser(user)
            );
        }

        // convert and filter
        let sensors = convertRowsToSensors(result);
        if (queryData) {
            if (queryData.favorite) {
                const favSensors = await (
                    await this.getFavoriteSensors(user, queryData.type ? { type: queryData.type } : undefined)
                ).map((s) => s.id);
                sensors = sensors.filter((s) => favSensors.includes(s.id));
            }

            if (queryData.houseId) sensors = sensors.filter((s) => s.device?.house.id === queryData.houseId);
            if (queryData.deviceId) sensors = sensors.filter((s) => s.device?.id === queryData.deviceId);
            if (queryData.type) sensors = sensors.filter((s) => s.type === queryData.type);
            if (queryData.label) sensors = sensors.filter((s) => s.label === queryData.label);
            if (queryData.sensorIds) sensors = sensors.filter((s) => queryData.sensorIds!.includes(s.id));
        }

        // return
        return sensors;
    }

    /**
     * Returns sensor with specified ID
     *
     * @param user
     * @param sensorId ID of sensor to lookup
     * @throws Error if sensor not found if user do not have access to the enclosing house
     */
    async getSensor(user: BackendIdentity, sensorId: string): Promise<Sensor> {
        // trim id
        const use_sensorId = sensorId.trim();

        // get sensor
        let result;
        if (this.isAllDataAccessUser(user)) {
            result = await this.dbService.query(
                `select ${SENSOR_COLUMNS}, ${DEVICE_COLUMNS}, ${HOUSE_COLUMNS} from sensor s, device d, house h where s.deviceId=d.id and d.houseId=h.id and s.id=$1 order by s.name asc`,
                sensorId
            );
        } else {
            result = await this.dbService.query(
                `select ${SENSOR_COLUMNS}, ${DEVICE_COLUMNS}, ${HOUSE_COLUMNS} from sensor s, device d, (select id, name from house h, user_house_access u where h.id=u.houseId and u.userId=$1) h where s.deviceId=d.id and d.houseId=h.id and s.id=$2 order by s.name asc`,
                this.getUserIdFromUser(user),
                use_sensorId
            );
        }
        if (!result || result.rowCount !== 1) {
            throw Error(`Unable to find sensor with ID <${use_sensorId}>`);
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
    async getSensorOrUndefined(user: BackendIdentity, sensorId: string): Promise<Sensor | undefined> {
        try {
            const s = await this.getSensor(user, sensorId);
            return s;
        } catch (err) {
            return undefined;
        }
    }

    /**
     * Creates a sensor on the specified device.
     *
     * @param user
     * @param data
     * @throws Error if the user do not have access to the enclosing house or sensor id not unique
     */
    async createSensor(
        user: BackendIdentity,
        { deviceId, id, name, label, type, icon, scaleFactor }: CreateSensorType
    ): Promise<Sensor> {
        // validate
        const use_id = id.trim();
        const use_name = name.trim();
        const use_label = label ? label.trim() : undefined;

        // ensure sensor id doesn't contain __
        if (use_id.indexOf("__") >= 0) {
            throw new Error("Sensor ID may not contain double underscore (__)");
        }

        // get device to ensure it exists and user have accesss
        await this.getDevice(user, deviceId);

        // create sensor
        await this.dbService.query(
            `insert into sensor (deviceid, id, name, label, type, icon, scalefactor) values ($1, $2, $3, $4, $5, $6, $7)`,
            deviceId,
            use_id,
            use_name,
            use_label,
            type,
            icon,
            scaleFactor
        );

        // get sensor
        const sensor = await this.getSensor(user, use_id);

        // publish event
        this.eventService.publish(`${constants.TOPICS.CONTROL}.sensor.create`, {
            new: {
                deviceId: deviceId,
                id: use_id,
                name: use_name,
                label: use_label,
                type: type,
                icon: icon,
                scaleFactor: scaleFactor,
            },
            user: user,
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
    async updateSensor(
        user: BackendIdentity,
        { id, name, label, type, icon, scaleFactor, timeoutSeconds }: UpdateSensorType
    ): Promise<Sensor> {
        // validate
        const use_id = id.trim();
        const use_name = name.trim();
        const use_label = label ? label.trim() : undefined;

        // get sensor (also validates access)
        const sensor = await this.getSensor(user, use_id);

        // update sensor
        const result = await this.dbService.query(
            "update sensor set name=$1, label=$2, type=$3, icon=$5, scalefactor=$6, timeout_seconds=$7 where id=$4",
            use_name,
            use_label,
            type,
            use_id,
            icon,
            scaleFactor,
            timeoutSeconds !== undefined ? timeoutSeconds : null
        );
        if (!result || result.rowCount !== 1) {
            throw Error(`Unable to update sensor with ID <${use_id}>`);
        }

        // publish event
        this.eventService.publish(`${constants.TOPICS.CONTROL}.sensor.update`, {
            new: {
                deviceId: sensor.deviceId,
                id: use_id,
                name: use_name,
                label: use_label,
                type: type,
                icon: icon,
                scaleFactor: scaleFactor,
                timeoutSeconds: timeoutSeconds,
            },
            old: {
                deviceId: sensor.deviceId,
                id: use_id,
                name: sensor.name,
                label: sensor.label,
                type: sensor.type,
                icon: sensor.icon,
                scaleFactor: sensor.scaleFactor,
                timeoutSeconds: sensor.timeoutSeconds,
            },
            user: user,
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
    async deleteSensor(user: BackendIdentity, { id }: DeleteSensorType): Promise<void> {
        // validate
        const use_id = id.trim();

        // get sensor (also validates access)
        const sensor = await this.getSensor(user, use_id);

        // delete the sensor
        await this.dbService.query("delete from sensor where id=$1", use_id);

        // publish event
        this.eventService.publish(`${constants.TOPICS.CONTROL}.sensor.delete`, {
            old: {
                deviceId: sensor.deviceId,
                id: use_id,
                name: sensor.name,
                label: sensor.label,
                type: sensor.type,
                scaleFactor: sensor.scaleFactor,
            },
            user: user,
        });
    }

    /**
     * Returns the sensors marked as favorite for the supplied user.
     *
     * @param user
     */
    async getFavoriteSensors(user: BackendIdentity, data?: FavoriteSensorsInput) {
        const result = await this.dbService.query(
            `select ${SENSOR_COLUMNS}, ${DEVICE_COLUMNS}, ${HOUSE_COLUMNS} from sensor s, device d, (select id, name from house h, user_house_access u where h.id=u.houseId and u.userId=$1 and u.houseId=$2) h where s.deviceid=d.id and d.houseid=h.id and s.id in (select sensorId from favorite_sensor where userId=$1) order by s.name asc`,
            this.getUserIdFromUser(user),
            user.identity.houseId
        );
        let sensors = convertRowsToSensors(result);
        if (data) {
            if (data.type) {
                sensors = sensors.filter((s) => s.type === data.type);
            }
        }
        return sensors;
    }

    /**
     * Adds the sensor with the supplied ID as a favorite sensor.
     *
     * @param user
     * @param id
     */
    async addFavoriteSensor(user: BackendIdentity, id: string) {
        await this.dbService.query(
            "insert into favorite_sensor (userId, sensorId) values ($1, $2) on conflict do nothing",
            this.getUserIdFromUser(user),
            id
        );
    }

    /**
     * Removes the sensor with the supplied ID as a favorite sensor.
     *
     * @param user
     * @param id
     */
    async removeFavoriteSensor(user: BackendIdentity, id: string) {
        await this.dbService.query(
            "delete from favorite_sensor where userId=$1 and sensorId=$2",
            this.getUserIdFromUser(user),
            id
        );
    }

    /**
     * Returns last N number of samples read from the database for the sensor with the
     * supplied ID.
     *
     * @param sensorId
     * @param samples
     */
    async getLastNSamplesForSensor(
        user: BackendIdentity,
        sensorId: string,
        samples: number = LAST_N_SAMPLES,
        applyScaleFactor: boolean = true
    ): Promise<SensorSample[] | undefined> {
        // get sensor to validate access
        await this.getSensor(user, sensorId);

        // get data
        return this.dbService
            .query(
                `select sd.value as value, sd.dt dt, case when s.scalefactor is null then 1 else s.scalefactor end from sensor_data sd left outer join sensor s on sd.id=s.id where sd.id='${sensorId}' order by dt desc limit ${samples}`
            )
            .then((result) => {
                const arr = result.rows.map((row) => {
                    return {
                        id: sensorId,
                        dt: row.dt,
                        value: applyScaleFactor ? row.value * row.scalefactor : row.value,
                    } as SensorSample;
                });
                return Promise.resolve(arr);
            });
    }

    /**
     * Returns the samples read for the sensor with the supplied ID with a timestamp
     * greater of equal to the supplied start date and smaller or equal to the supplied
     * end date.
     *
     * @param sensorId
     * @param start
     * @param end
     */
    async getSamplesForSensor(
        user: BackendIdentity,
        sensorId: string,
        start: Date,
        end: Date,
        onlyEveryXSample: number = 1,
        applyScaleFactor: boolean = true
    ): Promise<SensorSample[] | undefined> {
        // get sensor to validate access
        await this.getSensor(user, sensorId);

        // get data
        const result = await this.dbService.query(
            `select t.* from (select sd.value as value, sd.dt dt, case when s.scalefactor is null then 1 else s.scalefactor end, row_number() over (order by dt desc) as row from sensor_data sd left outer join sensor s on sd.id=s.id where sd.id=$1 and dt >= $2 and dt <= $3 order by dt desc) t where t.row % $4 = 0`,
            sensorId,
            start,
            end,
            onlyEveryXSample
        );
        const arr = result.rows.map((row) => {
            return {
                id: sensorId,
                dt: row.dt,
                value: applyScaleFactor ? row.value * row.scalefactor : row.value,
            } as SensorSample;
        });
        return arr;
    }

    /**
     * Insert the supplied reading for the supplied sensor id.
     *
     * @param id
     * @param value
     * @param dt
     */
    async persistSensorSample(
        sensor: Sensor,
        value: number,
        dt: moment.Moment,
        from_dt?: moment.Moment
    ): Promise<void> {
        let str_sql;
        let persistValue = value;
        let args = [sensor.id, persistValue, dt.toISOString()];
        if (from_dt) {
            args.push(from_dt.toISOString());
            str_sql = "insert into sensor_data (id, value, dt, from_dt) values ($1, $2, $3, $4)";
        } else {
            str_sql = "insert into sensor_data (id, value, dt) values ($1, $2, $3)";
        }
        await this.dbService.query(str_sql, ...args);
    }

    async persistPowermeterReadingFromDeviceRequest(sample: SmartmeDeviceWithDataType) {
        logger.debug(
            `Persisting powermeter sample - id <${
                sample.id
            }> dt <${sample.valueDate.toISOString()}> ActiveEnergyTotalExport <${
                sample.counterReadingExport
            }> ActiveEnergyTotalImport <${
                sample.counterReadingImport
            }> ActivePowerPhaseL1 <${undefined}> ActivePowerPhaseL2 <${undefined}> ActivePowerPhaseL3 <${undefined}> ActivePowerTotal <${
                sample.activePower
            }> CurrentPhaseL1 <${sample.currentL1}> CurrentPhaseL2 <${sample.currentL2}> CurrentPhaseL3 <${
                sample.currentL3
            }> VoltagePhaseL1 <${sample.voltageL1}> VoltagePhaseL2 <${sample.voltageL2}> VoltagePhaseL3 <${
                sample.voltageL3
            }>`
        );
        this.dbService.query(
            `insert into powermeter_data (
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
            sample.id,
            sample.valueDate.toISOString(),
            sample.counterReadingExport,
            sample.counterReadingImport,
            undefined,
            undefined,
            undefined,
            sample.activePower,
            sample.currentL1,
            sample.currentL2,
            sample.currentL3,
            sample.voltageL1,
            sample.voltageL2,
            sample.voltageL3
        );
    }

    /**
     * Returns the endpoint for the supplied user or all users if an all-access-user is supplied. The
     * bearer token is truncted.
     *
     * @param user
     * @returns
     */
    async getCalloutEndpoints(user: BackendIdentity): Promise<CalloutEndpoint[]> {
        let result;
        if (this.isAllDataAccessUser(user)) {
            result = await this.dbService.query("select id, name, baseurl, userid, system_managed from callout_endpoint");
        } else {
            result = await this.dbService.query(
                "select id, name, baseurl, userid, system_managed from callout_endpoint where userid=$1",
                user.identity.callerId
            );
        }

        return result.rows.map((row) => {
            return {
                id: row.id,
                name: row.name,
                baseUrl: row.baseurl,
                systemManaged: row.system_managed
            } as CalloutEndpoint;
        });
    }

    async createUserCallout(user: BackendIdentity, input: {
        id: string;
        name: string;
        endpointId: string;
        authenticatorId?: string;
        method: HttpMethod;
        pathTemplate: string;
        bodyTemplate?: string;
        headers?: Record<string, string>;
    }, systemManaged = false): Promise<Callout> {
        const userid = user.identity.callerId;
        logger.debug(`Creating callout record with id <${input.id}> for user <${userid}>`);
        await this.dbService.query(
            "insert into callout (id, userid, name, endpointid, method, authenticatorid, path_template, body_template, system_managed) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
            input.id,
            userid,
            input.name,
            input.endpointId,
            input.method,
            input.authenticatorId || null,
            input.pathTemplate,
            input.bodyTemplate || null,
            systemManaged
        );
        return (await this.getUserCallout(user, input.id))!;
    }

    async getUserCallout(user: BackendIdentity, id: string) : Promise<Callout | undefined> {
        if (this.isAllDataAccessUser(user)) {
            const calloutResult = await this.dbService.query(
                "select c.id c_id, c.name c_name, c.method c_method, c.path_template c_path_template, c.body_template c_body_template, c.authenticatorid c_authenticatorid, c.userid c_userid, c.system_managed c_system_managed, e.id e_id, e.name e_name, e.baseurl e_baseurl from callout c, callout_endpoint e where c.endpointid=e.id and c.id=$1",
                id
            );
            if (calloutResult.rowCount === 0) return undefined;
            const row = calloutResult.rows[0];
            const authenticators = await this.getAllCalloutAuthenticators();
            return {
                id: row.c_id,
                name: row.c_name,
                endpoint: { id: row.e_id, name: row.e_name, baseUrl: row.e_baseurl },
                method: row.c_method as HttpMethod,
                pathTemplate: row.c_path_template,
                bodyTemplate: row.c_body_template,
                authenticator: authenticators.find(a => a.id === row.c_authenticatorid),
                systemManaged: row.c_system_managed
            } as Callout;
        }
        const callouts = await this.getUserCallouts(user);
        return callouts.find(c => c.id === id);
    }

    async getUserCallouts(user: BackendIdentity) : Promise<Array<Callout>> {
        const calloutResult = await this.dbService.query("select c.id c_id, c.name c_name, c.method c_method, c.path_template c_path_template, c.body_template c_body_template, c.content_type c_content_type, c.authenticatorid c_authenticatorid, c.system_managed c_system_managed, e.id e_id, e.name e_name, e.baseurl e_baseurl from callout c, callout_endpoint e where c.endpointid=e.id and c.userid=$1", user.identity.callerId);
        if (calloutResult.rowCount === 0) return [];

        const authenticators = await this.getCalloutAuthenticators(user);

        return calloutResult.rows.map(row => {
            return {
                id: row.c_id,
                name: row.c_name,
                endpoint: {
                    id: row.e_id,
                    name: row.e_name,
                    baseUrl: row.e_baseurl
                },
                method: row.c_method as HttpMethod,
                pathTemplate: row.c_path_template,
                bodyTemplate: row.c_body_template,
                contentType: row.c_content_type,
                authenticator: authenticators.find(a => a.id === row.c_authenticatorid),
                systemManaged: row.c_system_managed
            } as Callout;
        })
    }

    async createCallout(user: BackendIdentity, input: { name: string; endpointId: string; method: HttpMethod; authenticatorId?: string; pathTemplate: string; bodyTemplate?: string; contentType?: string }): Promise<Callout> {
        const userid = user.identity.callerId;
        const id = uuid();
        await this.dbService.query(
            "insert into callout (id, userid, name, endpointid, method, authenticatorid, path_template, body_template, content_type) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
            id, userid, input.name, input.endpointId, input.method, input.authenticatorId || null, input.pathTemplate, input.bodyTemplate || null, input.contentType || null
        );
        const endpoints = await this.getCalloutEndpoints(user);
        const authenticators = await this.getCalloutAuthenticators(user);
        return {
            id,
            name: input.name,
            endpoint: endpoints.find(e => e.id === input.endpointId)!,
            authenticator: authenticators.find(a => a.id === input.authenticatorId),
            method: input.method,
            pathTemplate: input.pathTemplate,
            bodyTemplate: input.bodyTemplate,
            contentType: input.contentType,
        };
    }

    async updateCallout(user: BackendIdentity, input: { id: string; name: string; endpointId: string; method: HttpMethod; authenticatorId?: string; pathTemplate: string; bodyTemplate?: string; contentType?: string }): Promise<Callout> {
        const userid = user.identity.callerId;
        await this.dbService.query(
            "update callout set name=$1, endpointid=$2, method=$3, authenticatorid=$4, path_template=$5, body_template=$6, content_type=$7 where id=$8 and userid=$9",
            input.name, input.endpointId, input.method, input.authenticatorId || null, input.pathTemplate, input.bodyTemplate || null, input.contentType || null, input.id, userid
        );
        const endpoints = await this.getCalloutEndpoints(user);
        const authenticators = await this.getCalloutAuthenticators(user);
        return {
            id: input.id,
            name: input.name,
            endpoint: endpoints.find(e => e.id === input.endpointId)!,
            authenticator: authenticators.find(a => a.id === input.authenticatorId),
            method: input.method,
            pathTemplate: input.pathTemplate,
            bodyTemplate: input.bodyTemplate,
            contentType: input.contentType,
        };
    }

    async deleteCallout(user: BackendIdentity, input: DeleteInput, force = false): Promise<boolean> {
        const userid = user.identity.callerId;
        if (!force) {
            const check = await this.dbService.query("select system_managed from callout where id=$1", input.id);
            if (check.rowCount === 1 && check.rows[0].system_managed) {
                throw new Error("Cannot delete a system-managed callout");
            }
        }
        const result = await this.dbService.query("delete from callout where id=$1 and userid=$2", input.id, userid);
        return result.rowCount === 1;
    }

    async createCalloutEndpoint(user: BackendIdentity, input: CreateCalloutEndpointInput, systemManaged = false): Promise<CalloutEndpoint> {
        const userid = user.identity.callerId;
        const id = uuid();
        logger.debug(`Creating endpoint record with id <${id}> for user <${userid}>`);
        await this.dbService.query(
            "insert into callout_endpoint (id, name, baseurl, userid, system_managed) values ($1,$2,$3,$4,$5)",
            id,
            input.name,
            input.baseUrl,
            userid,
            systemManaged
        );
        logger.trace(`Created endpoint record with id <${id}> for user <${userid}>`);

        // return
        return (await this.getCalloutEndpoints(user)).find((e) => e.id === id)!;
    }

    async updateCalloutEndpoint(user: BackendIdentity, input: UpdateCalloutEndpointInput): Promise<CalloutEndpoint> {
        const userid = user.identity.callerId;

        let queryFields = [];
        let queryData = [userid, input.id];
        if (input.name && input.name.length) {
            queryFields.push(`name=\$${queryData.length + 1}`);
            queryData.push(input.name);
        }
        if (input.baseUrl && input.baseUrl.length) {
            queryFields.push(`baseurl=\$${queryData.length + 1}`);
            queryData.push(input.baseUrl);
        }
        logger.debug(`Updating endpoint record with id <${input.id}> for user <${userid}>`);
        const result = await this.dbService.query(
            `update callout_endpoint set ${queryFields.join(",")} where userid=$1 and id=$2`,
            ...queryData
        );

        if (result.rowCount === 1) {
            logger.trace(`Updated endpoint record with id <${input.id}> for user <${userid}>`);
        } else {
            throw new Error(`Unable to update endpoint - expected 1 as rowCount but was ${result.rowCount}`);
        }

        // return
        return (await this.getCalloutEndpoints(user)).find((e) => e.id === input.id)!;
    }

    async deleteCalloutEndpoint(user: BackendIdentity, input: DeleteCalloutEndpointInput, force = false): Promise<boolean> {
        const userid = user.identity.callerId;
        if (!force) {
            const check = await this.dbService.query("select system_managed from callout_endpoint where id=$1", input.id);
            if (check.rowCount === 1 && check.rows[0].system_managed) {
                throw new Error("Cannot delete a system-managed endpoint");
            }
        }
        logger.debug(`Deleting callout endpoint record with id <${input.id}> for user <${userid}>`);
        const result = await this.dbService.query("delete from callout_endpoint where userid=$1 and id=$2", userid, input.id);
        if (result.rowCount === 1) {
            logger.trace(`Deleted callout_endpoint record with id <${input.id}> for user <${userid}>`);
            return true;
        } else {
            logger.error(`Unable to delete endpoint record with id <${input.id}> for user <${userid}>`);
            throw new Error(`Unable to delete endpoint record with id <${input.id}> for user <${userid}>`);
        }
    }

    /**
     * Returns the callout authenticators for the supplied user or for all users if an 
     * all-access-user is supplied. 
     *
     * @param user
     * @returns
     */
    async getCalloutAuthenticators(user: BackendIdentity): Promise<CalloutAuthenticator[]> {
        let result;
        if (this.isAllDataAccessUser(user)) {
            result = await this.dbService.query(
                "select a.id as auth_id, a.name as auth_name, template as auth_template, a.system_managed as auth_system_managed, e.id as ep_id, e.name as ep_name, e.baseurl as ep_baseurl from callout_authenticator a, callout_endpoint e where a.endpointid=e.id"
            );
        } else {
            result = await this.dbService.query(
                "select a.id as auth_id, a.name as auth_name, template as auth_template, a.system_managed as auth_system_managed, e.id as ep_id, e.name as ep_name, e.baseurl as ep_baseurl from callout_authenticator a, callout_endpoint e where a.endpointid=e.id and a.userid=$1",
                user.identity.callerId
            );
        }

        // get replacements
        const authenticatorIds = result.rows.map(row => row.auth_id);
        const placeholders = authenticatorIds.map((_, i) => `$${i + 1}`).join(",");
        const resultReplacements = authenticatorIds.length > 0 ? await this.dbService.query(`select * from callout_authenticator_replacement where authenticatorid IN (${placeholders})`,
            ...authenticatorIds
        ) : { rows: [] };

        // get secrets
        const secrets = await this.getUserCalloutSecrets(user);

        // loop and return
        return result.rows.map((row) => {
            const authenticatorId = row.auth_id;
            const template = this.parseAuthenticatorTemplate(row.auth_template);

            // get replacements
            const replacements : Record<string,CalloutSecret> = {};
            resultReplacements.rows.forEach(row => {
                if (row.authenticatorid === authenticatorId) {
                    const s = secrets.find(s => s.id === row.secretid)!;
                    replacements[row.name] = s;
                }
            })

            const auth = {
                id: authenticatorId,
                name: row.auth_name,
                template,
                endpoint: {
                    id: row.ep_id,
                    name: row.ep_name,
                    baseUrl: row.ep_baseurl
                },
                templateMappings: replacements,
                systemManaged: row.auth_system_managed
            } as CalloutAuthenticator;
            return auth;
        });
    }

    private parseAuthenticatorTemplate(value: string): AuthenticatorTemplate {
        switch (value) {
            case DATACLOUD_CLIENTCREDENTIALS: return AuthenticatorTemplate.DATACLOUD_CLIENTCREDENTIALS;
            case DATACLOUD_WEBSDK: return AuthenticatorTemplate.DATACLOUD_WEBSDK;
            case STATIC_BEARERTOKEN: return AuthenticatorTemplate.STATIC_BEARERTOKEN;
            case CLIENTCREDENTIALS_OAUTH: return AuthenticatorTemplate.CLIENTCREDENTIALS_OAUTH;
            default: return AuthenticatorTemplate.DATACLOUD_CLIENTCREDENTIALS;
        }
    }

    private async getAllCalloutAuthenticators(): Promise<CalloutAuthenticator[]> {
        const result = await this.dbService.query(
            "select a.id as auth_id, a.name as auth_name, template as auth_template, a.userid as auth_userid, a.system_managed as auth_system_managed, e.id as ep_id, e.name as ep_name, e.baseurl as ep_baseurl from callout_authenticator a, callout_endpoint e where a.endpointid=e.id"
        );

        const authenticatorIds = result.rows.map(row => row.auth_id);
        const placeholders = authenticatorIds.map((_, i) => `$${i + 1}`).join(",");
        const resultReplacements = authenticatorIds.length > 0 ? await this.dbService.query(`select * from callout_authenticator_replacement where authenticatorid IN (${placeholders})`,
            ...authenticatorIds
        ) : { rows: [] };

        // get all secrets (unmasked) for service use
        const allSecrets = await this.dbService.query("select id, name, value from callout_secret");

        return result.rows.map((row) => {
            const authenticatorId = row.auth_id;
            const template = this.parseAuthenticatorTemplate(row.auth_template);

            const replacements: Record<string, CalloutSecret> = {};
            resultReplacements.rows.forEach(repRow => {
                if (repRow.authenticatorid === authenticatorId) {
                    const s = allSecrets.rows.find(s => s.id === repRow.secretid);
                    if (s) replacements[repRow.name] = { id: s.id, name: s.name, value: s.value };
                }
            });

            return {
                id: authenticatorId,
                name: row.auth_name,
                template,
                endpoint: { id: row.ep_id, name: row.ep_name, baseUrl: row.ep_baseurl },
                templateMappings: replacements,
                systemManaged: row.auth_system_managed,
            } as CalloutAuthenticator;
        });
    }

    async createCalloutAuthenticator(user: BackendIdentity, input: CreateCalloutAuthenticatorInput, systemManaged = false): Promise<CalloutAuthenticator> {
        const userid = user.identity.callerId;

        // get secrets for user and ensure there is a mapping for each required replacement
        const secrets = await this.getUserCalloutSecrets(user);
        const authTempl = templates[input.template];
        Object.keys(authTempl.placeholders).forEach(placeholder => {
            const mapping = input.templateMappings.find(mapping => mapping.name === placeholder);
            if (!mapping) {
                throw new Error(`Missing mapping for replacement <${placeholder}>`);
            }
        })

        // create authenticator
        const id = uuid();
        logger.debug(`Creating callout_authenticator record with id <${id}> for user <${userid}>`);
        try {
            await this.dbService.query(
                "insert into callout_authenticator (id, name, endpointid, template, userid, system_managed) values ($1,$2,$3,$4,$5,$6)",
                id,
                input.name,
                input.endpointId,
                input.template,
                userid,
                systemManaged
            );
            const replacementRows = await Promise.all(input.templateMappings.map(async (mapping) => {
                // get secret
                const replacementId = uuid();
                return this.dbService.query("insert into callout_authenticator_replacement (id, name, secretid, authenticatorid) values ($1, $2, $3, $4)",
                    replacementId, mapping.name, mapping.secretId, id
                );
            }));
            await this.dbService.query("commit");
            logger.debug(`Committed callout authenticator <${id}> and replacements into database`);
        } catch (err) {
            await this.dbService.query("rollback");
            const msg = "Unable to insert callout authenticator and replacements into database - rolling back";
            logger.warn(msg);
            throw new Error(msg)
        }
        
        // return
        return (await this.getCalloutAuthenticators(user)).find((e) => e.id === id)!;
    }

    async updateCalloutAuthenticator(user: BackendIdentity, input: UpdateCalloutAuthenticatorInput): Promise<CalloutAuthenticator> {
        const userid = user.identity.callerId;

        /*
        let queryFields = [];
        let queryData = [userid, input.id];
        if (input.name && input.name.length) {
            queryFields.push(`name=\$${queryData.length + 1}`);
            queryData.push(input.name);
        }
        if (input.baseUrl && input.baseUrl.length) {
            queryFields.push(`baseurl=\$${queryData.length + 1}`);
            queryData.push(input.baseUrl);
        }
        logger.debug(`Updating endpoint record with id <${input.id}> for user <${userid}>`);
        const result = await this.dbService.query(
            `update callout_endpoint set ${queryFields.join(",")} where userid=$1 and id=$2`,
            ...queryData
        );

        if (result.rowCount === 1) {
            logger.trace(`Updated endpoint record with id <${input.id}> for user <${userid}>`);
        } else {
            throw new Error(`Unable to update endpoint - expected 1 as rowCount but was ${result.rowCount}`);
        }
        */

        // return
        return (await this.getCalloutAuthenticators(user)).find((e) => e.id === input.id)!;
    }

    async deleteCalloutAuthenticator(user: BackendIdentity, input: DeleteInput, force = false): Promise<boolean> {
        const userid = user.identity.callerId;
        if (!force) {
            const check = await this.dbService.query("select system_managed from callout_authenticator where id=$1", input.id);
            if (check.rowCount === 1 && check.rows[0].system_managed) {
                throw new Error("Cannot delete a system-managed authenticator");
            }
        }
        logger.debug(`Deleting callout authenticator record with id <${input.id}> for user <${userid}>`);
        const result = await this.dbService.query("delete from callout_authenticator where userid=$1 and id=$2", userid, input.id);
        if (result.rowCount === 1) {
            logger.trace(`Deleted callout_authenticator record with id <${input.id}> for user <${userid}>`);
            return true;
        } else {
            const msg = `Unable to delete callout authenticator record with id <${input.id}> for user <${userid}>`;
            logger.error(msg);
            throw new Error(msg);
        }
    }

    /**
     * Returns all onSensorSample event definitions along with requried info for actually
     * performing the callout. Must have all-data-access to call.
     *
     * @param user
     * @param sensorId
     * @returns
     */
    async getAllOnSensorSampleEvents(user: BackendIdentity, _sensorId: string): Promise<OnSensorSampleEvent[]> {
        if (!this.isAllDataAccessUser(user)) throw new Error("Must have all data access");
        /*
        const result = await this.dbService.query(
            "select event_onsensorsample.id as eventid, sensorid, event_onsensorsample.userid as userid, endpointid, method, path, body, baseurl, bearertoken, fn, ln, email from event_onsensorsample, endpoint, login_user where sensorid=$1 and event_onsensorsample.endpointid=endpoint.id and login_user.id=event_onsensorsample.userid",
            sensorId
        );
        */
        return [];
        /*
        return result.rows.map((row) => {
            const e = {
                id: row.eventid,
                user: {
                    id: row.userid,
                    fn: row.fn,
                    ln: row.ln,
                    email: row.email,
                },
                path: row.path,
                method: getHttpMethod(row.method),
                bodyTemplate: row.body,
                endpoint: {
                    baseUrl: row.baseurl,
                    bearerToken: row.bearertoken,
                    id: row.endpointid,
                },
            } as OnSensorSampleEvent;
            return e;
        });
        */
    }

    async getUserOnSensorSampleEvents(user: BackendIdentity, sensorId?: string): Promise<OnSensorSampleEvent[]> {
        if (this.isAllDataAccessUser(user)) throw new Error("Use method for all-data-access users");
        let result;
        if (sensorId) {
            result = await this.dbService.query(
                "select event_onsensorsample.id id, endpointid, endpoint.name endpointname, endpoint.baseurl, method, contenttype, path, body from event_onsensorsample, endpoint where event_onsensorsample.endpointid=endpoint.id and sensorid=$2 and event_onsensorsample.userid=$1",
                user.identity.callerId,
                sensorId
            );
        } else {
            result = await this.dbService.query(
                "select event_onsensorsample.id id, endpointid, endpoint.name endpointname, endpoint.baseurl, method, contenttype, path, body from event_onsensorsample, endpoint where event_onsensorsample.endpointid=endpoint.id and event_onsensorsample.userid=$1",
                user.identity.callerId
            );
        }
        return result.rows.map((row) => {
            const e = {
                id: row.id,
                path: row.path,
                method: getHttpMethod(row.method),
                contenttype: getContentType(row.contenttype),
                bodyTemplate: row.body,
                endpoint: {
                    baseUrl: row.baseurl,
                    name: row.endpointname,
                    id: row.endpointid,
                },
            } as OnSensorSampleEvent;
            return e;
        });
    }

    async createOnSensorSampleEvent(
        user: BackendIdentity,
        input: CreateOnSensorSampleEventInput
    ): Promise<OnSensorSampleEvent> {
        const userid = user.identity.callerId;
        const id = uuid();
        logger.debug(`Creating event_onsensorsample record with id <${id}> for user <${userid}>`);
        await this.dbService.query(
            "insert into event_onsensorsample (id, path, body, method, endpointid, sensorid, userid, contenttype) values ($1, $2, $3,$4,$5,$6,$7,$8)",
            id,
            input.path,
            input.bodyTemplate,
            input.method === HttpMethod.POST ? "POST" : "GET",
            input.endpointId,
            input.sensorId,
            userid,
            input.contentType
        );
        logger.trace(`Created event_onsensorsample record with id <${id}> for user <${userid}>`);

        // return
        return (await this.getUserOnSensorSampleEvents(user, input.sensorId)).find((e) => e.id === id)!;
    }

    async updateOnSensorSampleEvent(
        user: BackendIdentity,
        input: UpdateOnSensorSampleEventInput
    ): Promise<OnSensorSampleEvent> {
        const userid = user.identity.callerId;

        let queryFields = [];
        let queryData = [userid, input.id];
        if (input.path && input.path.length) {
            queryFields.push(`path=\$${queryData.length + 1}`);
            queryData.push(input.path);
        }
        if (input.bodyTemplate && input.bodyTemplate.length) {
            queryFields.push(`body=\$${queryData.length + 1}`);
            queryData.push(input.bodyTemplate);
        }
        if (input.method) {
            queryFields.push(`method=\$${queryData.length + 1}`);
            queryData.push(input.method == HttpMethod.POST ? "POST" : "GET");
        }
        if (input.contentType) {
            queryFields.push(`contenttype=\$${queryData.length + 1}`);
            queryData.push(input.contentType);
        }
        logger.debug(`Updating event_onsensorsample record with id <${input.id}> for user <${userid}>`);
        const result = await this.dbService.query(
            `update event_onsensorsample set ${queryFields.join(",")} where userid=$1 and id=$2`,
            ...queryData
        );

        if (result.rowCount === 1) {
            logger.trace(`Updated event_onsensorsample record with id <${input.id}> for user <${userid}>`);
        } else {
            throw new Error(
                `Unable to update event_onsensorsample - expected 1 as rowCount but was ${result.rowCount}`
            );
        }

        // return
        return (await this.getUserOnSensorSampleEvents(user)).find((e) => e.id === input.id)!;
    }

    async deleteOnSensorSampleEvent(user: BackendIdentity, input: DeleteInput): Promise<boolean> {
        const userid = user.identity.callerId;

        logger.debug(`Deleting event_onsensorsample record with id <${input.id}> for user <${userid}>`);
        const result = await this.dbService.query(
            "delete from event_onsensorsample where userid=$1 and id=$2",
            userid,
            input.id
        );
        if (result.rowCount === 1) {
            logger.trace(`Deleted event_onsensorsample record with id <${input.id}> for user <${userid}>`);
            return true;
        } else {
            logger.error(`Unable to delete event_onsensorsample record with id <${input.id}> for user <${userid}>`);
            throw new Error(`Unable to delete event_onsensorsample record with id <${input.id}> for user <${userid}>`);
        }
    }

    async getUserCalloutSecrets(user: BackendIdentity) : Promise<Array<CalloutSecret>> {
        let result;
        if (this.isAllDataAccessUser(user)) {
            result = await this.dbService.query("select id, name, value, system_managed from callout_secret");
        } else {
            result = await this.dbService.query(
                "select id, name, value, system_managed from callout_secret where userid=$1",
                user.identity.callerId
            );
        }
        return result.rows.map(row => {
            let value = row.value;
            if (user.identity.impersonationId  !== "*" && !this.isAllDataAccessUser(user)) {
                value = value.length < 10 ? "xxxxxxxxxx" : `${value.substring(0, value.length / 5)}...`;
            }
            return {
                id: row.id,
                name: row.name,
                value: value,
                systemManaged: row.system_managed
            } as CalloutSecret;
        });
    }

    async createCalloutSecret(
        user: BackendIdentity,
        input: CreateCalloutSecretInput,
        systemManaged = false
    ): Promise<CalloutSecret> {
        const userid = user.identity.callerId;
        const id = uuid();
        logger.debug(`Creating secret record with id <${id}> for user <${userid}>`);
        await this.dbService.query(
            "insert into callout_secret (id, userid, name, value, system_managed) values ($1, $2, $3, $4, $5)",
            id,
            userid,
            input.name,
            input.value,
            systemManaged
        );
        logger.trace(`Created secret record with id <${id}> for user <${userid}>`);

        // return
        return (await this.getUserCalloutSecrets(user)).find(s => s.id === id)!;
    }

    async updateCalloutSecret(
        user: BackendIdentity,
        input: UpdateCalloutSecretInput
    ): Promise<CalloutSecret> {
        const userid = user.identity.callerId;

        let queryFields = [];
        let queryData = [userid, input.id];
        if (input.name) {
            queryFields.push(`name=\$${queryData.length + 1}`);
            queryData.push(input.name);
        }
        if (input.value) {
            queryFields.push(`value=\$${queryData.length + 1}`);
            queryData.push(input.value);
        }
        logger.debug(`Updating secret record with id <${input.id}> for user <${userid}>`);
        const result = await this.dbService.query(
            `update callout_secret set ${queryFields.join(",")} where userid=$1 and id=$2`,
            ...queryData
        );

        if (result.rowCount === 1) {
            logger.trace(`Updated secret record with id <${input.id}> for user <${userid}>`);
        } else {
            throw new Error(
                `Unable to update secret - expected 1 as rowCount but was ${result.rowCount}`
            );
        }

        // return
        return (await this.getUserCalloutSecrets(user)).find(s => s.id === input.id)!;
    }

    async deleteCalloutSecret(user: BackendIdentity, input: DeleteCalloutSecretInput, force = false): Promise<boolean> {
        const userid = user.identity.callerId;
        if (!force) {
            const check = await this.dbService.query("select system_managed from callout_secret where id=$1", input.id);
            if (check.rowCount === 1 && check.rows[0].system_managed) {
                throw new Error("Cannot delete a system-managed secret");
            }
        }
        logger.debug(`Deleting secret record with id <${input.id}> for user <${userid}>`);
        const result = await this.dbService.query(
            "delete from callout_secret where userid=$1 and id=$2",
            userid,
            input.id
        );
        if (result.rowCount === 1) {
            logger.trace(`Deleted secret record with id <${input.id}> for user <${userid}>`);
            return true;
        } else {
            logger.error(`Unable to delete secret record with id <${input.id}> for user <${userid}>`);
            throw new Error(`Unable to delete secret record with id <${input.id}> for user <${userid}>`);
        }
    }

    async getTokenIssuerInformationByKid(kid: string) : Promise<TokenIssuerInformation> {
        const result = await this.dbService.query("select id, public_key, issuer, houseid from jwt_issuers where id=$1", kid);
        if (result.rowCount !== 1) {
            logger.error(`Unable to find JWT issuer with kid <${kid}>`);
            throw new Error(`Unable to find JWT issuer with kid <${kid}>`);
        }

        // get the users for the house
        const houseId = result.rows[0].houseid;
        const users = await this.dbService.query("select userid from USER_HOUSE_ACCESS where houseid=$1", houseId);
        const subjects = users.rows.map(u => u.userid as string);

        // return
        return {
            issuer: result.rows[0].issuer,
            publicKey: Buffer.from(result.rows[0].public_key, "base64"),
            subjects,
            houseId
        } as TokenIssuerInformation

    }

    async getCronJobs(user: BackendIdentity): Promise<CronJob[]> {
        let result;
        if (this.isAllDataAccessUser(user)) {
            result = await this.dbService.query("select * from cron_job");
        } else {
            result = await this.dbService.query("select * from cron_job where userid=$1", user.identity.callerId);
        }
        return result.rows.map(row => ({
            id: row.id,
            userId: row.userid,
            jobType: row.job_type as CronJobType,
            active: row.active,
            frequencyMinutes: row.frequency_minutes,
            config: row.config || {},
            calloutId: row.callout_id,
            sensorId: row.sensor_id,
            houseId: row.house_id,
        } as CronJob));
    }

    async getAllCronJobs(user: BackendIdentity): Promise<CronJob[]> {
        if (!this.isAllDataAccessUser(user))
            throw Error("You must have all data access to get all cron jobs");
        const result = await this.dbService.query("select * from cron_job");
        return result.rows.map(row => ({
            id: row.id,
            userId: row.userid,
            jobType: row.job_type as CronJobType,
            active: row.active,
            frequencyMinutes: row.frequency_minutes,
            config: row.config || {},
            calloutId: row.callout_id,
            sensorId: row.sensor_id,
            houseId: row.house_id,
        } as CronJob));
    }

    async createCronJob(user: BackendIdentity, input: {
        jobType: CronJobType;
        frequencyMinutes: number;
        config: Record<string, any>;
        calloutId?: string;
        sensorId?: string;
        houseId?: string;
    }): Promise<CronJob> {
        const userid = user.identity.callerId;
        const id = uuid();
        await this.dbService.query(
            "insert into cron_job (id, userid, job_type, frequency_minutes, config, callout_id, sensor_id, house_id) values ($1,$2,$3,$4,$5,$6,$7,$8)",
            id, userid, input.jobType, input.frequencyMinutes,
            JSON.stringify(input.config),
            input.calloutId || null,
            input.sensorId || null,
            input.houseId || null
        );

        this.eventService!.publish(`${constants.TOPICS.CONTROL}.cronjob.create`, {
            new: { id, ...input, userId: userid },
            user,
        });

        return {
            id,
            userId: userid,
            jobType: input.jobType,
            active: true,
            frequencyMinutes: input.frequencyMinutes,
            config: input.config,
            calloutId: input.calloutId,
            sensorId: input.sensorId,
            houseId: input.houseId,
        };
    }

    async updateCronJob(user: BackendIdentity, id: string, input: {
        active?: boolean;
        frequencyMinutes?: number;
    }): Promise<CronJob> {
        const userid = user.identity.callerId;
        const fields: string[] = [];
        const args: any[] = [id, userid];
        if (input.active !== undefined) {
            fields.push(`active=$${args.length + 1}`);
            args.push(input.active);
        }
        if (input.frequencyMinutes !== undefined) {
            fields.push(`frequency_minutes=$${args.length + 1}`);
            args.push(input.frequencyMinutes);
        }
        if (!fields.length) throw new Error("No fields to update");
        const result = await this.dbService.query(
            `update cron_job set ${fields.join(",")} where id=$1 and userid=$2 returning *`,
            ...args
        );
        if (result.rowCount === 0) throw new Error(`Unable to update cron job with id <${id}>`);
        const row = result.rows[0];
        const job: CronJob = {
            id: row.id,
            userId: row.userid,
            jobType: row.job_type as CronJobType,
            active: row.active,
            frequencyMinutes: row.frequency_minutes,
            config: row.config || {},
            calloutId: row.callout_id,
            sensorId: row.sensor_id,
            houseId: row.house_id,
        };
        this.eventService!.publish(`${constants.TOPICS.CONTROL}.cronjob.update`, {
            new: job,
            user,
        });
        return job;
    }

    async deleteCronJob(user: BackendIdentity, id: string): Promise<boolean> {
        const userid = user.identity.callerId;
        const result = await this.dbService.query("delete from cron_job where id=$1 and userid=$2 returning *", id, userid);
        if (result.rowCount === 1) {
            this.eventService!.publish(`${constants.TOPICS.CONTROL}.cronjob.delete`, {
                old: { id },
                user,
            });
            return true;
        }
        throw new Error(`Unable to delete cron job with id <${id}>`);
    }

    private isAllDataAccessUser(user: BackendIdentity) {
        return user.identity.callerId === "*";
    }

    private isAllHousesAccessUser(user: BackendIdentity) {
        return user && user.identity.houseId === "*";
    }

    private getUserIdFromUser(user: BackendIdentity): string {
        if (!user) throw Error("Must supply a user object");
        if (user.identity.impersonationId) return user.identity.impersonationId;
        return user.identity.callerId;
    }

    async getSensorsWithTimeout(_user: BackendIdentity): Promise<Sensor[]> {
        const result = await this.dbService.query(
            `select ${SENSOR_COLUMNS}, ${DEVICE_COLUMNS}, ${HOUSE_COLUMNS} from sensor s, device d, house h where s.deviceId=d.id and d.houseId=h.id and s.timeout_seconds is not null order by s.name asc`
        );
        return convertRowsToSensors(result);
    }

    async getDevicesWithTimeout(_user: BackendIdentity): Promise<Device[]> {
        const result = await this.dbService.query(
            `select ${DEVICE_COLUMNS}, ${HOUSE_COLUMNS} from device d join house h on d.houseid=h.id where d.timeout_seconds is not null order by d.name asc`
        );
        return convertRowsToDevices(result);
    }

    async getEventDefinitions(_user: BackendIdentity, targetId: string, triggerType?: EventTriggerType): Promise<EventDefinition[]> {
        let sql = "select id, userid, sensorid, deviceid, active, trigger_type, action_type, action_config from event_definition where (sensorid=$1 or deviceid=$1)";
        const params: any[] = [targetId];
        if (triggerType) {
            sql += " and trigger_type=$2";
            params.push(triggerType);
        }
        const result = await this.dbService.query(sql, ...params);
        return result.rows.map(row => ({
            id: row.id,
            userId: row.userid,
            sensorId: row.sensorid,
            deviceId: row.deviceid,
            active: row.active,
            triggerType: row.trigger_type as EventTriggerType,
            actionType: row.action_type as EventActionType,
            actionConfig: row.action_config,
        } as EventDefinition));
    }

    async getActiveEventDefinitions(targetId: string, triggerType: EventTriggerType): Promise<EventDefinition[]> {
        const result = await this.dbService.query(
            "select id, userid, sensorid, deviceid, active, trigger_type, action_type, action_config from event_definition where (sensorid=$1 or deviceid=$1) and trigger_type=$2 and active=true",
            targetId,
            triggerType
        );
        return result.rows.map(row => ({
            id: row.id,
            userId: row.userid,
            sensorId: row.sensorid,
            deviceId: row.deviceid,
            active: row.active,
            triggerType: row.trigger_type as EventTriggerType,
            actionType: row.action_type as EventActionType,
            actionConfig: row.action_config,
        } as EventDefinition));
    }

    async createEventDefinition(user: BackendIdentity, input: { sensorId?: string; deviceId?: string; triggerType: EventTriggerType; actionType: EventActionType; actionConfig: Record<string, any> }): Promise<EventDefinition> {
        const userid = this.isAllDataAccessUser(user) ? null : user.identity.callerId;
        const id = uuid();
        await this.dbService.query(
            "insert into event_definition (id, userid, sensorid, deviceid, trigger_type, action_type, action_config) values ($1, $2, $3, $4, $5, $6, $7)",
            id,
            userid,
            input.sensorId || null,
            input.deviceId || null,
            input.triggerType,
            input.actionType,
            JSON.stringify(input.actionConfig)
        );
        return {
            id,
            userId: userid || undefined,
            sensorId: input.sensorId,
            deviceId: input.deviceId,
            active: true,
            triggerType: input.triggerType,
            actionType: input.actionType,
            actionConfig: input.actionConfig,
        };
    }

    async updateEventDefinition(user: BackendIdentity, input: { id: string; triggerType: EventTriggerType; actionType: EventActionType; actionConfig: Record<string, any>; active: boolean }): Promise<EventDefinition> {
        let result;
        if (this.isAllDataAccessUser(user)) {
            result = await this.dbService.query(
                "update event_definition set trigger_type=$1, action_type=$2, action_config=$3, active=$4 where id=$5 returning *",
                input.triggerType, input.actionType, JSON.stringify(input.actionConfig), input.active, input.id
            );
        } else {
            result = await this.dbService.query(
                "update event_definition set trigger_type=$1, action_type=$2, action_config=$3, active=$4 where id=$5 and (userid=$6 or userid is null) returning *",
                input.triggerType, input.actionType, JSON.stringify(input.actionConfig), input.active, input.id, user.identity.callerId
            );
        }
        if (!result.rowCount) throw new Error(`Unable to update event definition with id <${input.id}>`);
        const row = result.rows[0];
        return {
            id: row.id,
            userId: row.userid,
            sensorId: row.sensorid,
            deviceId: row.deviceid,
            active: row.active,
            triggerType: row.trigger_type,
            actionType: row.action_type,
            actionConfig: row.action_config,
        };
    }

    async deleteEventDefinition(user: BackendIdentity, id: string): Promise<boolean> {
        let result;
        if (this.isAllDataAccessUser(user)) {
            result = await this.dbService.query("delete from event_definition where id=$1", id);
        } else {
            result = await this.dbService.query("delete from event_definition where id=$1 and (userid=$2 or userid is null)", id, user.identity.callerId);
        }
        return result.rowCount === 1;
    }

    private ensureScope(user: BackendIdentity, scope: string): boolean {
        if (!scope || !constants.JWT.ALL_SCOPES.includes(scope)) throw Error(`Supplied scope <${scope}> is invalid`);
        logger.debug(`Ensure user <${user.identity.callerId}> with scopes <${user.scopes}> has scope ${scope}`);
        if (!user.scopes.includes(scope)) throw Error(`Missing required scope <${scope}>`);
        logger.debug(`Found scope <${scope}> for user <${user.identity.callerId}>`);
        return true;
    }
}

