import { promisify } from "util";
import { BaseService } from "../types";
import { URL } from "url";
import { createClient as createRedisClient } from "redis";
import { LogService } from "./log-service";

const CONNECTION_TIMEOUT =
    process.env.REDIS_CONNECTION_TIMEOUT ?
        Number.parseInt(process.env.REDIS_CONNECTION_TIMEOUT) :
        20000;

const client = (function () {
    const redis_uri = process.env.REDIS_TLS_URL ? new URL(process.env.REDIS_TLS_URL) : process.env.REDIS_URL ? new URL(process.env.REDIS_URL) : undefined;
    if (process.env.REDIS_URL && redis_uri && redis_uri.protocol!.indexOf("rediss") === 0) {
        return createRedisClient({
            port: Number.parseInt(redis_uri.port!),
            host: redis_uri.hostname!,
            password: redis_uri.password,
            db: 0,
            tls: {
                rejectUnauthorized: false,
                requestCert: true,
                agent: false
            },
            connect_timeout: CONNECTION_TIMEOUT
        })
    } else {
        return createRedisClient({
            "url": process.env.REDIS_URL,
            "connect_timeout": CONNECTION_TIMEOUT
        });
    }
})();

const promisifiedClient = {
    'get': promisify(client.get).bind(client),
    'set': promisify(client.set).bind(client),
    'setex': promisify(client.setex).bind(client),
    'keys': promisify(client.keys).bind(client),
    'mget': promisify(client.mget).bind(client),
    'expire': promisify(client.expire).bind(client),
    'del': promisify(client.del).bind(client)
}

export class RedisService extends BaseService {
    public static NAME = "redis";

    constructor() {
        super(RedisService.NAME);
        this.dependencies = [LogService.NAME];
    }

    init(callback: (err?: Error) => {}, services: BaseService[]) {
        const log = services[0] as LogService;
        const dummyKey = `foo_${Date.now()}`;
        log.info(`Querying redis for dummy key (${dummyKey})`);
        client.get(dummyKey, (err, data) => {
            log.info("Queried redis for dummy key - result: " + data + ", err: " + err);
            callback(err || undefined);
        })
    }

    terminate() {
        return new Promise<void>((resolve) => {
            client.end();
            resolve();
        });
    }

    del(key: string): Promise<string> {
        return promisifiedClient.del(key);
    }
    get(key: string): Promise<string> {
        return promisifiedClient.get(key);
    }
    set(key: string, value: string): Promise<void> {
        return promisifiedClient.set(key, value) as Promise<void>;
    }
    setex(key: string, expire: number, value: string): Promise<string> {
        return promisifiedClient.setex(key, expire, value);
    }
    keys(pattern: string): Promise<string[]> {
        return promisifiedClient.keys(pattern);
    }
    mget(...keys: string[]): Promise<string[]> {
        return new Promise((resolve, reject) => {
            client.mget(keys, (err: Error | null, values: string[]) => {
                if (err) return reject(err);
                resolve(values);
            });
        });
    }
    expire(key: string, expire: number): Promise<number> {
        return promisifiedClient.expire(key, expire);
    }

    getClient() {
        return client;
    }
    getPromisifiedClient() {
        return promisifiedClient;
    }
}
