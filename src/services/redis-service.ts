import { BaseService } from "../types";
import { URL } from "url";
import { Logger } from "../logger";
import { Redis, RedisOptions } from "ioredis";

const logger = new Logger("redis-service");

const CONNECTION_TIMEOUT =
    process.env.REDIS_CONNECTION_TIMEOUT ?
        Number.parseInt(process.env.REDIS_CONNECTION_TIMEOUT) :
        20000;

export class RedisService extends BaseService {
    public static NAME = "redis";
    private client! : Redis;

    constructor() {
        super(RedisService.NAME);
    }

    async init(callback: (err?: Error) => {}) {
        this.client = this.createClient();
        const dummyKey = `foo_${Date.now()}`;
        logger.info(`Querying redis for dummy key (${dummyKey})`);
        try {
            const data = await this.client.get(dummyKey);
            logger.info("Queried redis for dummy key - result: " + data);
            callback(undefined);

        } catch (err) {
            logger.error("Error querying redis for dummy key", err);
            callback(err);
        }
    }

    terminate() {
        return new Promise<void>(async (resolve) => {
            await this.client.quit();
            resolve();
        });
    }

    createClient(options?: RedisOptions) : Redis {
        if (!process.env.REDIS_TLS_URL && !process.env.REDIS_URL) {
            throw new Error(`Both REDIS_TLS_URL and REDIS_URL is undefined - cannot init RedisService`);
        }
        const redis_uri = process.env.REDIS_TLS_URL
            ? new URL(process.env.REDIS_TLS_URL!)
            : new URL(process.env.REDIS_URL!);
        const redis_options: RedisOptions = Object.assign(
            {
                host: redis_uri.hostname!,
                port: Number.parseInt(redis_uri.port!),
                password: redis_uri.password,
            },
            options || { connectTimeout: CONNECTION_TIMEOUT }
        );
        if (process.env.REDIS_URL && redis_uri && redis_uri.protocol!.indexOf("rediss") === 0) {
            logger.debug(`Creating new Redis client and will use TLS to connect to <${redis_uri.host}>`);
            const r = new Redis(Object.assign(redis_options, {
                tls: {
                    rejectUnauthorized: false,
                    requestCert: true, 
                }
            }));
            return r;
        } else {
            logger.debug(`Creating new Redis client and will NOT use TLS to connect to <${redis_uri.host}>`);
            const r = new Redis(redis_options);
            return r;
        }
    }

    del(key: string) {
        return this.client.del(key);
    }
    get(key: string) {
        return this.client.get(key);
    }
    set(key: string, value: string) {
        return this.client.set(key, value);
    }
    setex(key: string, expire: number, value: string) {
        return this.client.setex(key, expire, value);
    }
    keys(pattern: string) {
        return this.client.keys(pattern);
    }
    mget(...keys: string[]) {
        return this.client.mget(keys);
        /*
        return new Promise((resolve, reject) => {
            client.mget(keys, (err: Error | null, values: string[]) => {
                if (err) return reject(err);
                resolve(values);
            });
        });
        */
    }
    expire(key: string, expire: number) {
        return this.client.expire(key, expire);
    }

    getClient() {
        return this.client;
    }
}
