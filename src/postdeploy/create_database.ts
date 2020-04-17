import {Pool} from "pg";
require('dotenv').config()
import * as fs from "fs";
import {join} from "path";
import * as readline from "readline";

const TARGET_DATABASE_VERSION = 2;

const pool = new Pool({
    'connectionString': process.env.DATABASE_URL,
    'ssl': process.env.NODE_ENV === 'production' ? true : false
});

const buildEntireSchema = () : Promise<void> => {
    console.log("Creating entire database schema...");
    return new Promise((resolve, reject) => {
        const lines : Array<string> = [];
        readline.createInterface({
            "input": fs.createReadStream(join(__dirname, "..", "..", "schema", "complete.sql"))
        }).on("line", line => {
            if (!line || line.trim().length === 0) return;
            lines.push(line);

        }).on("close", () => {
            const executeNext = () => {
                const line = lines.shift();
                if (!line) return resolve();
                pool.query(line).then(() => {
                    executeNext();
                }).catch(err => {
                    reject(err);
                })
            }
            executeNext();
        })
    })
}

const updateSchemaVersion_1to2 = () : Promise<void> => {
    return Promise.resolve();
}

pool.query("BEGIN").then(() => {
    // query for database_version table
    return pool.query(`select * from information_schema.tables where table_name='database_version'`);
}).then(result => {
    if (result.rowCount === 0) {
        // no database_version table exists - create entire schema
        console.log("No database_version table exists in schema - create entire schema");
        return buildEntireSchema();

    } else {
        // check version of database
        return pool.query("select version from database_version").then(result => {
            if (result.rowCount === 0) {
                // no rows in version table - create entire schema
                console.log("No rows in database_version table - create entire schema");
                return buildEntireSchema();

            } else {
                // get version
                const version = result.rows[0].version;
                if (version === 1) {
                    return updateSchemaVersion_1to2();

                } else if (version === TARGET_DATABASE_VERSION) {
                    console.log("We are at the newest version...");
                    return Promise.resolve();
                }

                // do not know what to do
                return Promise.reject(Error("Do not know what to do - aborting!"));
            }
        })
    }
}).then(() => {
    console.log("Committing...");
    return pool.query("COMMIT");
}).catch(err => {
    console.log("!! ERRROR !!");
    console.log(err.message);
    console.log("!! ROLLING BACK !!");
    return pool.query("ROLLBACK");
}).finally(() => {
    pool.end();
}).then(() => {
    console.log("Done...");
})
