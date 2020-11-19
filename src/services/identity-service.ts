import constants from "../constants";
import jwt from "jsonwebtoken";
import { LogService } from "./log-service";
import { BackendIdentity, BaseService, BrowserLoginResponse, BrowserUser, DevicePrincipal, Identity, LoginSource, SystemPrincipal } from "../types";
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
const generateJWT = async (userId : string | undefined, deviceId : string | undefined, houseId : string | undefined, scopes : string[]) => {
    const payload = {
        "scopes": scopes.join(" "),
        "houseid": houseId
    } as any;
    const options = {
        "algorithm": "HS256",
        "issuer": constants.JWT.OUR_ISSUER,
        "audience": constants.JWT.AUDIENCE
    } as any;
    if (userId && deviceId) {
        options["subject"] = deviceId;
        payload["imp"] = userId;
    } else if (userId) {
        options["subject"] = userId;
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
    private authUser : BackendIdentity;

    constructor() {
        super(IdentityService.NAME);
        this.dependencies = [LogService.NAME, DatabaseService.NAME, StorageService.NAME, RedisService.NAME];
    }

    async init(callback : (err?:Error) => {}, services : BaseService[]) {
        this.log = services[0] as LogService;
        this.db = services[1] as DatabaseService;
        this.storage = services[2] as StorageService;
        this.redis = services[3] as RedisService;
        this.authUser = await this.getServiceBackendIdentity(IdentityService.NAME);
        callback();
    }

    private getRedisKey(userId : string, impId : string) : string {
        return `${LOGIN_KEY_PREFIX}${userId}_${impId ? impId : userId}`;
    }

    async verifyJWT(token : string) : Promise<BackendIdentity> {
        const secret = process.env.API_JWT_SECRET as string;
        let decoded : any;
        try {
            // verify token
            decoded = await jwt.verify(token, secret, {
                "algorithms": ["HS256"],
                "audience": constants.JWT.AUDIENCE,
                "issuer": constants.JWT.ISSUERS
            })
        } catch (err) {
            throw Error(`Unable to verify JWT: ${err.message}`);
        }

        // we verified the token - now see if we have a BackendIdentity cached
        const redis_key = this.getRedisKey(decoded.sub, decoded.imp);
        const str_user = await this.redis.get(redis_key);
        if (str_user) {
            const user_obj = JSON.parse(str_user) as BackendIdentity;
            return user_obj;
        }

        // backend identity not found - create
        let ident : BackendIdentity;
        if (decoded.imp) {
            // there is an impersonation id in the token so it's for a non-user
            const device = await this.storage.getDevice(this.authUser, decoded.sub);
            ident = {
                "identity": {
                    "callerId": decoded.sub,
                    "impersonationId": decoded.imp,
                    "houseId": decoded.houseId
                } as Identity,
                "principal": new DevicePrincipal(device.name),
                "scopes": decoded.scopes.split(" ")
            } as BackendIdentity;
            
        } else {
            // lookup user
            const user = await this.storage.getUser(this.authUser, decoded.sub);
            ident = {
                "identity": {
                    "callerId": decoded.sub,
                    "impersonationId": undefined,
                    "houseId": decoded.houseId
                } as Identity,
                "principal": user,
                "scopes": decoded.scopes.split(" ")
            } as BackendIdentity;
        }

        // cache
        this.redis.setex(
            redis_key, 
            constants.DEFAULTS.REDIS.LOGINUSER_EXPIRATION_SECS, 
            JSON.stringify(ident));

        // return
        return ident;
    }

    async generateUserJWT(user : BackendIdentity, houseId : string | undefined) {
        this.log.info(`Issuing JWT for user <${user}> for house <${houseId}>`);

        // get house
        if (houseId) {
            const house = await this.storage.getHouse(user, houseId);
            return generateJWT(user.identity.callerId, undefined, house.id, constants.DEFAULTS.JWT.USER_SCOPES);
        } else {
            return generateJWT(user.identity.callerId, undefined, undefined, constants.DEFAULTS.JWT.USER_SCOPES);
        }
    }
    
    async generateDeviceJWT(user : BackendIdentity, deviceId : string) {
        this.log.info(`Issuing JWT for device <${deviceId}> on behalf of user <${user}>`);

        // get device
        const device = await this.storage.getDevice(user, deviceId);
        return generateJWT(user.identity.callerId, device.id, device.house.id, constants.DEFAULTS.JWT.DEVICE_SCOPES);
    }

    getImpersonationIdentity(user : BackendIdentity, userId : string) : BackendIdentity {
        if (userId === "*") throw Error(`Cannot issue impersonation user for userId=*`);
        if (user && user.identity.callerId === "*") {
            return {
                "identity": {
                    "callerId": userId,
                    "impersonationId": user.identity.callerId,
                    "houseId": user.identity.houseId
                },
                "principal": user.principal,
                "scopes": [constants.JWT.SCOPE_API]
            } as BackendIdentity;
        }

        throw Error(`Calling user not allowed to get impersonation users`);
    }

    getServiceBackendIdentity(serviceName : string) : BackendIdentity {
        return {
            "identity": {
                "callerId": "*",
                "impersonationId": undefined,
                "houseId": "*"
            },
            "principal": new SystemPrincipal(serviceName),
            "scopes": [constants.JWT.SCOPE_ADMIN]
        } as BackendIdentity;
    }

    /**
     * After logging using OIDC returns the user logging in from the database or 
     * inserts the user in the database and returns the internal user id.
     * 
     * @param param0 
     */
    async getOrCreateBrowserLoginResponse({source, oidc_sub, email, fn, ln} : CreateLoginUserInput) : Promise<BrowserLoginResponse> {
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

            // find default house id if any
            result = await this.db!.query("select houseId from user_house_access where userId=$1 and is_default=true", row.id);

            // return
            const houses = await this.storage.getHousesForUser(this.authUser, row.id);
            const houseId = result.rowCount === 1 ? result.rows[0].houseid : undefined;
            return {
                "userinfo": {
                    "id": row.id,
                    "fn": row.fn,
                    "ln": row.ln,
                    "email": row.email,
                    "houses": houses,
                    "houseId": houseId
                } as BrowserUser,
                "jwt": await this.generateUserJWT(this.getImpersonationIdentity(this.authUser, row.id), houseId)
            } as BrowserLoginResponse;

        } else {
            // we need to add the user
            const id = uuid();
            switch (source) {
                case LoginSource.google:
                    await this.db!.query("insert into login_user (id, email, fn, ln, google_sub) values ($1, $2, $3, $4, $5)", id, email, fn, ln, oidc_sub);
                    break;
            }

            // return
            return {
                "userinfo": {
                    "id": id,
                    "fn": fn,
                    "ln": ln,
                    "email": email,
                    "houseId": undefined,
                    "houses": []
                } as BrowserUser,
                "jwt": await this.generateUserJWT(this.getImpersonationIdentity(this.authUser, id), undefined)
            } as BrowserLoginResponse;
        }
    }

    async getLoginUserIdentity(userId : string, houseId : string | undefined) : Promise<BackendIdentity> {
        // lookup user
        const user = await this.storage.getUser(this.authUser, userId);
        const ident = {
            "identity": {
                "callerId": user.id,
                "impersonationId": undefined,
                "houseId": houseId
            } as Identity,
            "principal": user,
            "scopes": constants.DEFAULTS.JWT.USER_SCOPES
        } as BackendIdentity;

        // cache
        const redis_key = this.getRedisKey(user.id, user.id);
        this.redis.setex(
            redis_key, 
            constants.DEFAULTS.REDIS.LOGINUSER_EXPIRATION_SECS, 
            JSON.stringify(ident));

        // return
        return ident;
    }
    
}
