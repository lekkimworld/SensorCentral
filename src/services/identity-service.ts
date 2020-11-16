import constants from "../constants";
import jwt from "jsonwebtoken";
import { LogService } from "./log-service";
import { BackendLoginUser, BaseService, LoginSource, LoginUser } from "../types";
import { DatabaseService } from "./database-service";
import { StorageService } from "./storage-service";
import { QueryResult } from "pg";
import uuid from "uuid/v1";
import { RedisService } from "./redis-service";

export interface CreateLoginUserInput {
    source : LoginSource;
    oidc_sub : string;
    email : string;
    fn : string;
    ln : string;
}

const generateJWT = async (userId : string | undefined, deviceId : string | undefined, houseId : string, scopes : string[]) => {
    const payload = {
        "scopes": scopes.join(" "),
        "houseid": houseId
    } as any;
    const options = {
        "algorithm": "HS256",
        "issuer": constants.JWT.OUR_ISSUER,
        "audience": constants.JWT.AUDIENCE
    } as any;
    if (userId) {
        options["subject"] = userId;
    } else if (deviceId) {
        options["subject"] = deviceId;
        payload["device"] = true;
    } else {
        throw Error("Must supply userId or deviceId");
    }
    const token = await jwt.sign(payload, process.env.API_JWT_SECRET as string, options);
    return token;
}

const LOGIN_KEY_PREFIX = 'login:';

/**
 * Service listening on queues to perform persistance etc.
 * 
 */
export class IdentityService extends BaseService {
    public static NAME = "identity";
    private log : LogService;
    private db : DatabaseService;
    private storage : StorageService;
    private redis : RedisService;
    private authUser : LoginUser;

    constructor() {
        super(IdentityService.NAME);
        this.dependencies = [LogService.NAME, DatabaseService.NAME, StorageService.NAME, RedisService.NAME];
    }

    async init(callback : (err?:Error) => {}, services : BaseService[]) {
        this.log = services[0] as LogService;
        this.db = services[1] as DatabaseService;
        this.storage = services[2] as StorageService;
        this.redis = services[3] as RedisService;
        this.authUser = await this.getServicePrincipal(IdentityService.NAME);
        callback();
    }

    async generateUserJWT(user : LoginUser, houseId : string) {
        this.log.info(`Issuing JWT for user <${user.id}> for house <${houseId}>`);

        // get house
        const house = await this.storage.getHouse(user, houseId);
        return generateJWT(user.id, undefined, house.id, constants.DEFAULTS.JWT.USER_SCOPES);
    }
    
    async generateDeviceJWT(user : LoginUser, deviceId : string) {
        this.log.info(`Issuing JWT for device <${deviceId}> on behalf of user <${user.id}>`);

        // get device
        const device = await this.storage.getDevice(user, deviceId);
        return generateJWT(undefined, device.id, device.house.id, constants.DEFAULTS.JWT.DEVICE_SCOPES);
    }

    getServicePrincipal(serviceName : string) : LoginUser {
        return {
            "id": serviceName,
            "houseId": "*",
        } as LoginUser;
    }

    /**
     * After logging using OIDC returns the user logging in from the database or 
     * inserts the user in the database and returns the internal user id.
     * 
     * @param param0 
     */
    async getOrCreateLoginUserId({source, oidc_sub, email, fn, ln} : CreateLoginUserInput) : Promise<string> {
        // see if we can find the user by sub based on source
        let result : QueryResult | undefined;
        switch (source) {
            case LoginSource.google:
                result = await this.db!.query("select id, email, fn, ln, google_sub from login_user where google_sub=$1 OR email=$2", oidc_sub, email);
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
                        await this.db?.query("update login_user set google_sub=$1 where email=$2", oidc_sub, email)
                    }
                    break;
            }

            // return
            return row.id;

        } else {
            // we need to add the user
            const id = uuid();
            switch (source) {
                case LoginSource.google:
                    await this.db!.query("insert into login_user (id, email, fn, ln, google_sub) values ($1, $2, $3, $4, $5)", id, email, fn, ln, oidc_sub);
                    break;
            }

            // return
            return id;
        }
    }

    /**
     * Update the cached backend user with the supplied houseId.
     * 
     * @param userId
     * @param houseId
     * @returns true if updated or false if user not found
     */
    async updateCachedBackendLoginUser(userId : string, houseId : string) : Promise<boolean> {
        const redisKey = `${LOGIN_KEY_PREFIX}${userId}`;
        const str_user = await this.redis!.get(redisKey);
        if (str_user) {
            const user_obj = JSON.parse(str_user) as BackendLoginUser;
            user_obj.houseId = houseId;
            await this.redis!.set(redisKey, JSON.stringify(user_obj));
            return true;
        } else {
            return false;
        }
    }

    /**
     * Finds the BackendLoginUser instance for the id supplied in Redis or 
     * looks up in the database and caches in Redis.
     * 
     * @param user User or Device ID
     */
    async lookupBackendIdentity(userId : string) {
        // start in redis
        const redisKey = `${LOGIN_KEY_PREFIX}${userId}`;
        const str_user = await this.redis!.get(redisKey);
        if (str_user) {
            const user_obj = JSON.parse(str_user) as BackendLoginUser;
            return user_obj;
        }

        // not found - look up in database
        const result = await this.db!.query("select id, fn, ln, email, h.houseId houseId from login_user l left join (select userId, houseId from user_house_access where userId=$1 and is_default=true) h on l.id=h.userId where l.id=$2;", userId, userId);
        let user_obj : BackendLoginUser;
        if (!result || result.rowCount === 0) {
            // unable to find user - maybe a device - look for device
            try {
                // find device
                const device = await this.storage.getDevice(this.authUser, userId);
                user_obj = {
                    "id": device.id,
                    "houseId": device.house.id,
                    "scopes": constants.DEFAULTS.JWT.DEVICE_SCOPES,
                    "houses": []
                }
            } catch (err){
                throw Error(`Unable to find user OR device with id <${userId}>`);
            }
        } else {
            // found user - create object
            const row = result.rows[0];
            const houses = await this.storage.getHousesForUser(this.authUser, userId);
            user_obj = {
                "id": row.id,
                "fn": row.fn,
                "ln": row.ln,
                "email": row.email,
                "houseId": row.houseid,
                "houses": houses,
                "scopes": constants.DEFAULTS.JWT.USER_SCOPES
            };
        }

        // save in redis (do not wait)
        this.redis!.setex(redisKey, constants.DEFAULTS.REDIS.LOGINUSER_EXPIRATION_SECS, JSON.stringify(user_obj));

        // return 
        return user_obj;
    }
}
