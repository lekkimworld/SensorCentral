import { BaseService } from "../types";
import { URL } from "url";
import { createClient as createRedisClient, RedisClientType } from "redis";
import { LogService } from "./log-service";

const CONNECTION_TIMEOUT =
    process.env.REDIS_CONNECTION_TIMEOUT ?
        Number.parseInt(process.env.REDIS_CONNECTION_TIMEOUT) :
        20000;

const client = (function () {
    const redis_uri = process.env.REDIS_TLS_URL ? new URL(process.env.REDIS_TLS_URL as string) : process.env.REDIS_URL ? new URL(process.env.REDIS_URL as string) : undefined;
    console.log(`Redis URI: ${redis_uri}`);
    if (process.env.REDIS_URL && redis_uri && redis_uri.protocol!.indexOf("rediss") === 0) {
        return createRedisClient({
            socket: {
                port: Number.parseInt(redis_uri.port!),
                host: redis_uri.hostname!,
                tls: true, 
                rejectUnauthorized: false,
                requestCert: true,
                connectTimeout: CONNECTION_TIMEOUT
            },
            password: redis_uri.password
        })
    } else {
        return createRedisClient({
            url: redis_uri?.toString(),
            socket: {
                connectTimeout: CONNECTION_TIMEOUT
            }
        });
    }
})() as RedisClientType;

export class RedisService extends BaseService {
    public static NAME = "redis";

    constructor() {
        super(RedisService.NAME);
        this.dependencies = [LogService.NAME];
    }

    init(callback: (err?: Error) => {}, services: BaseService[]) {
        const log = services[0] as LogService;
        log.info("Querying redis for dummy key...");
        client.connect().then(() => {
            return client.get("foo");
        }).then(data => {
            log.info("Queried redis for dummy key - result: " + data);
            callback();
        }).catch(err => {
            log.info("Queried redis for dummy key - err: " + err);
            callback(err);
        })
    }

    terminate() {
        return client.quit();
    }

    del(key: string): Promise<number> {
        return client.del(key);
    }
    get(key: string): Promise<string|null> {
        return client.get(key);
    }
    set(key: string, value: string): Promise<string|null> {
        return client.set(key, value);
    }
    setex(key: string, expire: number, value: string): Promise<string|null> {
        return client.setEx(key, expire, value);
    }
    keys(pattern: string): Promise<string[]> {
        return client.keys(pattern);
    }
    mget(...keys: string[]): Promise<(string | null)[]> {
        return client.mGet(keys);
    }
    expire(key: string, expire: number): Promise<boolean> {
        return client.expire(key, expire);
    }

    getClient() {
        return client;
    }
}
