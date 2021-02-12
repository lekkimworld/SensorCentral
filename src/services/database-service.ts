import { Pool, QueryResult, PoolConfig } from "pg";
import { BaseService } from "../types";
import { LogService } from "./log-service";

const config: PoolConfig = {
    'connectionString': process.env.DATABASE_URL
};
if (process.env.NODE_ENV === "production") {
    config.ssl = true;
} else if (process.env.NODE_ENV === "development") {
    if (process.env.DATABASE_SSL) {
        config.ssl = {
            checkServerIdentity: false,
            rejectUnauthorized: false
        } as any;
    }
}

export class DatabaseService extends BaseService {
    public static NAME = "db";

    _pool?: Pool;

    constructor() {
        super(DatabaseService.NAME);
        this.dependencies = [LogService.NAME];
    }

    init(callback: (err?: Error) => {}, services: BaseService[]) {
        const log = services[0] as LogService;
        try {
            log.debug(`Creating database pool with config <${JSON.stringify(config)}>`);
            this._pool = new Pool(config);
            log.debug("Created database pool - performing query");
            this._pool.query("select count(*) from user").then(_result => {
                log.debug("Performed query with success - calling back");
                callback();
            }).catch(err => {
                log.error("Error performing query in init", err);
                callback(err);
            })

        } catch (err) {
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
