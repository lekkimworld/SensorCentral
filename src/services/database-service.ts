import {Pool, QueryResult, PoolConfig} from "pg";
import { BaseService } from "../types";

const config : PoolConfig = {
    'connectionString': process.env.DATABASE_URL
};
if (process.env.NODE_ENV === "production") {
    config.ssl = true;
} else if (process.env.NODE_ENV === "development") {
    config.ssl = {
        checkServerIdentity: false,
        rejectUnauthorized: false
    } as any;
}

export class DatabaseService extends BaseService {
    _pool? : Pool;

    constructor() {
        super("db");
    }

    //@ts-ignore
    init(callback : (err?:Error) => {}, services : BaseService[]) {
        try {
            this._pool = new Pool(config);
            callback();

        } catch (err) {
            callback(err);
        }
    }

    terminate() {
        if (this._pool) this._pool.end();
        return super.terminate();
    }

    query(query :  string, ...args : Array<any>) : Promise<QueryResult> {
        if (this._pool) return this._pool.query(query, args);
        return Promise.reject();
    }
}
