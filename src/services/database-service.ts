import { Pool, QueryResult, PoolConfig } from "pg";
import { BaseService } from "../types";
import { LogService } from "./log-service";
import { URL } from "url";

const url = new URL(process.env.DATABASE_URL as string);
const config: PoolConfig = {
    "database": url.pathname.substring(1),
    "host": url.hostname,
    "port": url.port ? Number.parseInt(url.port) : 5432,
    "user": url.username,
    "password": url.password
};
if (process.env.DATABASE_SSL || process.env.NODE_ENV === "production") {
    config.ssl = {
        rejectUnauthorized: false
    } as any;
}

export class DatabaseService extends BaseService {
    public static NAME = "db";

    _pool?: Pool;

    constructor() {
        super(DatabaseService.NAME);
        this.dependencies = [LogService.NAME];
    }

    async init(callback: (err?: Error) => {}, services: BaseService[]) {
        const log = services[0] as LogService;
        try {
            const config_clone = Object.assign({}, config);
            if (Object.hasOwnProperty.call(config_clone, "password")) {
                if (config_clone.password) {
                    config_clone.password = `${(config_clone.password! as string).substring(0, 5)}...`;
                } else {
                    config_clone.password = "<empty>";
                }
            }
            log.debug(`Creating database pool with config <${JSON.stringify(config_clone)}>`);
            this._pool = new Pool(config);
            log.debug("Querying via pool");
            await this._pool.query("select count(*) from user", []);
            log.debug("Completed query");
            callback();

        } catch (err) {
            log.error("Error performing query in init", err);
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
