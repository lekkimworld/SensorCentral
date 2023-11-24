import constants from "../constants";
import jwt from "jsonwebtoken";
import { Logger } from "../logger";
import { BackendIdentity, BaseService, BrowserLoginResponse, BrowserUser, DevicePrincipal, Identity, LoginSource, SystemPrincipal } from "../types";
import { DatabaseService } from "./database-service";
import { StorageService } from "./storage-service";
import { QueryResult } from "pg";
import {v1 as uuid} from "uuid";
import { RedisService } from "./redis-service";

const logger = new Logger("identity-service");

export interface CreateLoginUserInput {
    source: LoginSource;
    oidc_sub: string;
    email: string;
    fn: string;
    ln: string;
}
const generateJWT = async (userId: string | undefined, deviceId: string | undefined, houseId: string | undefined, scopes: string[]) => {
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
    private db: DatabaseService;
    private storage: StorageService;
    private redis: RedisService;
    private authUser: BackendIdentity;

    constructor() {
        super(IdentityService.NAME);
        this.dependencies = [DatabaseService.NAME, StorageService.NAME, RedisService.NAME];
    }

    async init(callback: (err?: Error) => {}, services: BaseService[]) {
        this.db = services[0] as DatabaseService;
        this.storage = services[1] as StorageService;
        this.redis = services[2] as RedisService;
        this.authUser = await this.getServiceBackendIdentity(IdentityService.NAME);
        callback();
    }

    private getRedisKey(userId: string, impId: string): string {
        return `${LOGIN_KEY_PREFIX}${userId}_${impId ? impId : userId}`;
    }

    async verifyJWT(token: string): Promise<BackendIdentity> {
        const secret = process.env.API_JWT_SECRET as string;
        let decoded: any;
        try {
            // verify token
            decoded = await jwt.verify(token, secret, {
                algorithms: ["HS256"],
                audience: constants.JWT.AUDIENCE,
                issuer: constants.JWT.ISSUERS,
            });
        } catch (err) {
            throw Error(`Unable to verify JWT: ${err.message}`);
        }

        // if there is no impersonation id see if it's a whitelisted device id
        const whitelistedDeviceIds = process.env.WHITELISTED_DEVICE_IDS
            ? process.env.WHITELISTED_DEVICE_IDS.split(",")
            : [];
        const whitelistedImpId = process.env.WHITELISTED_IMPERSONATION_ID;
        if (whitelistedImpId && !decoded.imp && whitelistedDeviceIds.includes(decoded.sub)) {
            decoded.imp = whitelistedImpId;
        }

        // we verified the token - now see if we have a BackendIdentity cached
        const redis_key = this.getRedisKey(decoded.sub, decoded.imp);
        const str_user = await this.redis.get(redis_key);
        if (str_user) {
            const user_obj = JSON.parse(str_user) as BackendIdentity;
            return user_obj;
        }

        // backend identity not found - create
        let ident: BackendIdentity;
        if (decoded.imp) {
            // there is an impersonation id in the token so it's for a non-user
            const device = await this.storage.getDevice(this.authUser, decoded.sub);
            ident = {
                identity: {
                    callerId: decoded.sub,
                    impersonationId: decoded.imp,
                    houseId: decoded.houseid,
                } as Identity,
                principal: new DevicePrincipal(device.name),
                scopes: decoded.scopes.split(" "),
            } as BackendIdentity;
        } else if (decoded.sub === "*") {
            ident = {
                identity: {
                    callerId: decoded.sub,
                    impersonationId: undefined,
                    houseId: decoded.houseId,
                } as Identity,
                principal: new SystemPrincipal("God"),
                scopes: decoded.scopes.split(" "),
            } as BackendIdentity;
        } else {
            // lookup user
            const user = await this.storage.getUser(this.authUser, decoded.sub);
            ident = {
                identity: {
                    callerId: decoded.sub,
                    impersonationId: undefined,
                    houseId: decoded.houseid,
                } as Identity,
                principal: user,
                scopes: decoded.scopes.split(" "),
            } as BackendIdentity;
        }

        // cache
        this.redis.setex(redis_key, constants.DEFAULTS.REDIS.LOGINUSER_EXPIRATION_SECS, JSON.stringify(ident));

        // return
        return ident;
    }

    async generateGodJWT() {
        return generateJWT("*", undefined, "*", constants.DEFAULTS.JWT.USER_SCOPES);
    }

    async generateUserJWT(user: BackendIdentity, houseId: string | undefined) {
        logger.info(`Issuing JWT for user <${user}> for house <${houseId}>`);

        // get house
        if (houseId) {
            const house = await this.storage.getHouse(user, houseId);
            return generateJWT(user.identity.callerId, undefined, house.id, constants.DEFAULTS.JWT.USER_SCOPES);
        } else {
            return generateJWT(user.identity.callerId, undefined, undefined, constants.DEFAULTS.JWT.USER_SCOPES);
        }
    }

    async generateDeviceJWT(user: BackendIdentity, deviceId: string) {
        logger.info(`Issuing JWT for device <${deviceId}> on behalf of user <${user}>`);

        // get device
        const device = await this.storage.getDevice(user, deviceId);
        return generateJWT(user.identity.callerId, device.id, device.house.id, constants.DEFAULTS.JWT.DEVICE_SCOPES);
    }

    getImpersonationIdentity(user: BackendIdentity, userId: string): BackendIdentity {
        if (userId === "*") throw Error(`Cannot issue impersonation user for userId=*`);
        if (user && user.identity.callerId === "*") {
            return {
                identity: {
                    callerId: userId,
                    impersonationId: user.identity.callerId,
                    houseId: user.identity.houseId,
                },
                principal: user.principal,
                scopes: [constants.JWT.SCOPE_API],
            } as BackendIdentity;
        }

        throw Error(`Calling user not allowed to get impersonation users`);
    }

    getServiceBackendIdentity(serviceName: string): BackendIdentity {
        logger.info(`Creating Service Backend Identity for <${serviceName}>`);
        const ident = {
            identity: {
                callerId: "*",
                impersonationId: undefined,
                houseId: "*",
            },
            principal: new SystemPrincipal(serviceName),
            scopes: [constants.JWT.SCOPE_ADMIN],
        } as BackendIdentity;
        return ident;
    }

    /**
     * Add a OIDC login mapping for the supplied user id, sub and provider. If the sub / provider 
     * combination exists we throw an exception.
     * 
     * @param id 
     * @param sub 
     * @param provider 
     */
    async addOidcMapping(id: string, sub: string, provider: LoginSource) : Promise<void> {
        logger.debug(`Attemping to add login provider for <${id}> to sub <${sub}> / <${provider}>`);
        let result = await this.db!.query("select userid from login_oidc_mapping where sub=$1 and provider=$2", sub, provider);
        if (result.rowCount > 0) throw new Error(`Found ${result.rowCount} rows for sub ${sub} - expected 0`);

        // add row
        await this.db!.query(
                "insert into login_oidc_mapping (userid, sub, provider, verified) values ($1, $2, $3, TRUE)",
                id,
                sub,
                provider
            );
    }

    /**
     * After logging using OIDC returns the user logging in from the database or
     * inserts the user in the database and returns the internal user id.
     *
     * @param param0
     */
    async getOrCreateBrowserLoginResponse({
        source,
        oidc_sub,
        email,
        fn,
        ln,
    }: CreateLoginUserInput): Promise<BrowserLoginResponse> {
        // see if we can find the user by sub based on source
        let result: QueryResult | undefined;
        logger.debug(`Querying database for user - sub <${oidc_sub}>`);
        switch (source) {
            case LoginSource.microsoft:
            case LoginSource.google:
            case LoginSource.github:
                result = await this.db!.query(
                    "select id, email, fn, ln from login_user join login_oidc_mapping on id=userid and provider=$1 and sub=$2",
                    source,
                    oidc_sub
                );
                break;
            default:
                throw Error(`Unhandled LoginSource <${source}>`);
        }
        logger.debug(`Database result - rows <${result ? result.rowCount : undefined}> (${result})`);

        if (result && result.rowCount === 1) {
            // found user
            const row = result.rows[0];
            logger.debug(`Found user in database (${row})`);

            // find default house id if any
            result = await this.db!.query(
                "select houseId from user_house_access where userId=$1 and is_default=true",
                row.id
            );

            // return
            logger.debug(`Getting ready to return data`);
            const houses = await this.storage.getHousesForUser(this.authUser, row.id);
            const houseId = result.rowCount === 1 ? result.rows[0].houseid : undefined;
            const jwt = await this.generateUserJWT(this.getImpersonationIdentity(this.authUser, row.id), houseId);
            const result_payload = {
                userinfo: {
                    id: row.id,
                    fn: row.fn,
                    ln: row.ln,
                    email: row.email,
                    houses: houses,
                    houseId: houseId,
                } as BrowserUser,
                jwt: jwt,
            } as BrowserLoginResponse;
            logger.debug(`Generated result payload`);
            return result_payload;
        } else {
            // user not found - we need to add the user
            logger.debug("We need to add the user");
            const id = uuid();
            await this.db!.query(
                "insert into login_user (id, email, fn, ln) values ($1, $2, $3, $4)",
                id,
                email,
                fn,
                ln
            );
            await this.db!.query(
                "insert into login_oidc_mapping (userid, sub, provider) values ($1, $2, $3)",
                id,
                oidc_sub,
                source
            );
            logger.debug(`Inserted user with UUID <${id}>`);

            // return
            const jwt = await this.generateUserJWT(this.getImpersonationIdentity(this.authUser, id), undefined);
            const result_payload = {
                userinfo: {
                    id: id,
                    fn: fn,
                    ln: ln,
                    email: email,
                    houseId: undefined,
                    houses: [],
                } as BrowserUser,
                jwt: jwt,
            } as BrowserLoginResponse;
            logger.debug(`Generated result payload`);
            return result_payload;
        }
    }

    async getLoginUserIdentity(userId: string, houseId: string | undefined): Promise<BackendIdentity> {
        // lookup user
        const user = await this.storage.getUser(this.authUser, userId);
        const ident = {
            identity: {
                callerId: user.id,
                impersonationId: undefined,
                houseId: houseId,
            } as Identity,
            principal: user,
            scopes: constants.DEFAULTS.JWT.USER_SCOPES,
        } as BackendIdentity;

        // cache
        const redis_key = this.getRedisKey(user.id, user.id);
        this.redis.setex(redis_key, constants.DEFAULTS.REDIS.LOGINUSER_EXPIRATION_SECS, JSON.stringify(ident));

        // return
        return ident;
    }

    /**
     * Removes a cache backend identity.
     *
     * @param user
     */
    removeCachedIdentity(user: BackendIdentity) {
        const redis_key = this.getRedisKey(user.identity.callerId, user.identity.callerId);
        this.redis.del(redis_key);
        logger.debug(`Deleted cached identity in Redis using key <${redis_key}>`);
    }
}
