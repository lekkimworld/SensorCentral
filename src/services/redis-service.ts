import {promisify} from "util";
import {BaseService} from "../types";
import * as redis from "redis";

const CONNECTION_TIMEOUT = 
    process.env.REDIS_CONNECTION_TIMEOUT ? 
    Number.parseInt(process.env.REDIS_CONNECTION_TIMEOUT) : 
    5000;

const client = redis.createClient({
    "url": process.env.REDIS_URL,
    "connect_timeout": CONNECTION_TIMEOUT
} as redis.ClientOpts);

const promisifiedClient = {
    'get': promisify(client.get).bind(client),
    'set': promisify(client.set).bind(client),
    'setex': promisify(client.setex).bind(client),
    'keys': promisify(client.keys).bind(client),
    'mget': promisify(client.mget).bind(client),
    'expire': promisify(client.expire).bind(client)
}

export class RedisService extends BaseService {
    constructor() {
        super("redis");
    }
    
    terminate() {
        return new Promise<void>((resolve) => {
            client.end();
            resolve();
        });
    }

    get(key:string) : Promise<string> {
        return promisifiedClient.get(key);
    }
    set(key:string, value:string) : Promise<void> {
        return promisifiedClient.set(key, value) as Promise<void>;
    }
    setex(key:string, expire:number, value:string) : Promise<string> {
        return promisifiedClient.setex(key, expire, value);
    }
    keys(pattern:string) : Promise<string[]> {
        return promisifiedClient.keys(pattern);
    }
    mget(...keys:string[]) : Promise<string[]> {
        return new Promise((resolve, reject) => {
            client.mget(keys, (err : Error | null, values : string[]) => {
                if (err) return reject(err);
                resolve(values);
            });
        });
    }
    expire(key:string, expire:number) : Promise<number> {
        return promisifiedClient.expire(key, expire);
    }

    getClient() {
        return client;
    }
    getPromisifiedClient() {
        return promisifiedClient;
    }
}
