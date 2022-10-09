import { Pool, QueryResult, PoolConfig } from "pg";
import { BaseService } from "../types";
import { Logger } from "../logger";
import { URL } from "url";
//@ts-ignore
import { getService } from "../configure-services";
import initdb from "../postdeploy/database-init-utils";

// get log
const logger = new Logger("database-service");

// get config and clone without password
const url = new URL(process.env.DATABASE_URL as string);
const config: PoolConfig = {
    "database": url.pathname.substring(1),
    "host": url.hostname,
    "port": url.port ? Number.parseInt(url.port) : 5432,
    "user": url.username,
    "password": url.password
};
if (process.env.NODE_ENV === "production" && process.env.DATABASE_SSL) {
    config.ssl = {
        rejectUnauthorized: false,
    } as any;
}
const config_clone = Object.assign({}, config);
if (Object.hasOwnProperty.call(config_clone, "password")) {
    if (config_clone.password) {
        config_clone.password = `${(config_clone.password! as string).substring(0, 5)}...`;
    } else {
        config_clone.password = "<empty>";
    }
}

const dbpool: Promise<Pool> = new Promise(async (resolve, reject) => {
    let retries = 5;

    while (retries) {
        try {
            logger.debug(`Attempting to create a database pool with config <${JSON.stringify(config_clone)}>`);
            const p = new Pool(config);
            logger.debug("Created database pool - attempting querying via pool");
            await p.query("select count(*) from user", []);
            logger.debug("Completed query - acquired database connection");
            resolve(p);
            break;
        } catch (err) {
            retries -= 1;
            logger.warn(`Unable to get database pool - retries left: ${retries}`);
            await new Promise((res) => setTimeout(res, 5000));
        }
    }
    reject(new Error("Unable to get database connection within 5 retries"));
});

export class DatabaseService extends BaseService {
    public static NAME = "db";

    _pool: Pool;

    constructor() {
        super(DatabaseService.NAME);
    }

    async init(callback: (err?: Error) => {}) {
        try {
            // wait for database pool
            this._pool = await dbpool;

            // see if database is initialized
            if (process.env.ALLOW_DB_INIT && process.env.ALLOW_DB_INIT.toLowerCase().substring(0, 1) === 't') {
                logger.info("Checking if database is initialized");
                await initdb(false);
            }

            // callback
            callback();

        } catch (err) {
            logger.error("Error performing query in init", err);
            callback(err);
        }
    }

    terminate() {
        if (this._pool) this._pool.end();
        return super.terminate();
    }

    query(query: string, ...args: Array<any>): Promise<QueryResult> {
        if (this._pool) return this._pool.query(query, args);
        return Promise.reject();
    }
}
