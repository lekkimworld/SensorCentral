import {Pool, QueryResult} from "pg";
import { BaseService } from "../types";

export class DatabaseService extends BaseService {
    _pool? : Pool;

    constructor() {
        super("db");
    }

    init(callback : (err?:Error) => {}, services : BaseService[]) {
        try {
            this._pool = new Pool({
                'connectionString': process.env.DATABASE_URL,
                'ssl': process.env.NODE_ENV === 'production' ? true : false
            });
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
