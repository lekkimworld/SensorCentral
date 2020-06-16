import {Pool, PoolConfig} from "pg";
require('dotenv').config()
import * as fs from "fs";
import {join} from "path";
import * as readline from "readline";
import moment from "moment-timezone";

const TARGET_DATABASE_VERSION = 5;

const config : PoolConfig = {
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

const pool = new Pool(config);

const executeSQLFile = (filename : string) : Promise<void> => {
    return new Promise((resolve, reject) => {
        const lines : Array<string> = [];
        readline.createInterface({
            "input": fs.createReadStream(join(__dirname, "..", "..", "schema", filename))
        }).on("line", line => {
            if (!line || line.trim().length === 0) return;
            lines.push(line);

        }).on("close", () => {
            const executeNext = () => {
                const line = lines.shift();
                if (!line) return resolve();
                console.log(`[SQL] Executing line: ${line}`);
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

const TEST_SENSOR_ID_COUNTER = "mysensor_3-1";

const addProgrammaticTestData = async () : Promise<void> => {
    const mDt = moment().tz("Europe/Copenhagen").set("hours", 12).set("minute", 0).set("second", 0);
    const mEnd = moment(mDt).subtract(48, "hour");

    while (mDt.isAfter(mEnd)) {
        const value = Math.floor(Math.random() * 10);

        const str_dt = mDt.toISOString();
        mDt.subtract(2, "minute");
        const str_from_dt = mDt.toISOString();

        await pool.query(
            "insert into sensor_data (id, value, from_dt, dt) values ($1, $2, $3, $4)", 
            [
                TEST_SENSOR_ID_COUNTER, 
                value,
                str_from_dt,
                str_dt
            ]
        );

    }
}

const buildEntireSchema = async () : Promise<void> => {
    console.log("Creating entire database schema...");
    await executeSQLFile(`complete_v${TARGET_DATABASE_VERSION}.sql`)
    if (process.env.NODE_ENV === "development") {
        console.log("NODE_ENV is set to development so injecting test data in database...");
        await executeSQLFile("testdata.sql");
        await addProgrammaticTestData();
    }
}

const updateSchemaVersion_1to2 = () : Promise<void> => {
    return Promise.resolve();
}

const updateSchemaVersion_2to3 = () : Promise<void> => {
    console.log("Updating database schema from version 2 to 3...");
    return executeSQLFile("version_2_to_3.sql");
}

const updateSchemaVersion_3to4 = () : Promise<void> => {
    console.log("Updating database schema from version 3 to 4...");
    return executeSQLFile("version_3_to_4.sql");
}

const updateSchemaVersion_4to5 = () : Promise<void> => {
    console.log("Updating database schema from version 4 to 5...");
    return executeSQLFile("version_4_to_5.sql");
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
                } else if (version === 2) {
                    return updateSchemaVersion_2to3();
                } else if (version === 3) {
                    return updateSchemaVersion_3to4();
                } else if (version === 4) {
                    return updateSchemaVersion_4to5();
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
    return Promise.all([Promise.resolve(0), pool.query("COMMIT")]);
}).catch(err => {
    console.log("!! ERRROR !!");
    console.log(err.message);
    console.log("!! ROLLING BACK !!");
    return Promise.all([Promise.resolve(1), pool.query("ROLLBACK")]);
}).finally(() => {
    pool.end();
}).then((data) => {
    console.log(`Done... (return code is ${data[0]})`);
    process.exit(data[0] as number);
})
