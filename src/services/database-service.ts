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

    async init(callback: (err?: Error) => {}, services: BaseService[]) {
        const log = services[0] as LogService;
        try {
            log.debug(`Creating database pool with config <${JSON.stringify(config)}>`);
            this._pool = new Pool(config);
            log.debug("Created database pool - getting client");
            const client = await this._pool.connect();
            log.debug("Querying via client");
            await client.query("select count(*) from user");
            await client.release();
            log.debug("Released client");
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
