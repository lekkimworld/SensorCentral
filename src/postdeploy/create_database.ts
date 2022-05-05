import { Pool, PoolConfig } from "pg";
import { config as dotenv_config} from "dotenv";
import * as fs from "fs";
import { join } from "path";
import * as readline from "readline";
import moment from "moment-timezone";

// read config
dotenv_config();

const TARGET_DATABASE_VERSION = 11;

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

const pool = new Pool(config);

const executeSQLFile = (filename: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const lines: Array<string> = [];
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

const TEST_SENSOR_ID_GAUGE = "mysensor_5-1";
const TEST_SENSOR_ID_DELTA1 = "mysensor_3-1"; // scalefactor 1/1000 = 0.001
const TEST_SENSOR_ID_DELTA2 = "mysensor_3-2"; // scalefactor 1/1000 = 0.001
const TEST_SENSOR_ID_COUNTER = "94f7a0f4-d85b-4815-9c77-833be7c28779"; // scalefactor 1/500 = 0.002

const addProgrammaticTestData = async (): Promise<void> => {
    // add for delta sensor
    console.log("addProgrammaticTestData_Gauge()");
    await addProgrammaticTestData_Gauge();

    // add for delta sensor
    console.log("addProgrammaticTestData_Delta");
    await addProgrammaticTestData_Delta(TEST_SENSOR_ID_DELTA1);
    await addProgrammaticTestData_Delta(TEST_SENSOR_ID_DELTA2);

    // add for counter sensor
    console.log("addProgrammaticTestData_Counter");
    await addProgrammaticTestData_Counter();
}

const addProgrammaticTestData_Gauge = async (): Promise<void> => {
    const mDt = moment().tz("Europe/Copenhagen").set("hours", 12).set("minute", 0).set("second", 0);
    const mEnd = moment(mDt).subtract(48, "hour");

    console.log("Get client");
    const client = await pool.connect();
    console.log("Got client");
    const baseValue = 20;
    while (mDt.isAfter(mEnd)) {
        const value = Math.random() * 10;

        const str_dt = mDt.toISOString();
        mDt.subtract(2, "minute");
        await client.query(
            "insert into sensor_data (id, value, dt) values ($1, $2, $3)",
            [
                TEST_SENSOR_ID_GAUGE,
                baseValue + value,
                str_dt
            ]
        );
        console.log(`Did INSERT of sensor (${TEST_SENSOR_ID_GAUGE})`);
    }
    client.release();
    console.log("Released client");
}

const addProgrammaticTestData_Delta = async (sensorId: string): Promise<void> => {
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
                sensorId,
                value,
                str_from_dt,
                str_dt
            ]
        );
        console.log(`Did INSERT of sensor (${sensorId})`);
    }
}

const addProgrammaticTestData_Counter = async (): Promise<void> => {
    const mDt = moment().tz("Europe/Copenhagen").set("hours", 12).set("minute", 0).set("second", 0);
    const mEnd = moment(mDt).subtract(48, "hour");

    let value = 27112;
    while (mDt.isAfter(mEnd)) {
        const increment = Math.floor(Math.random() * 20);
        value -= increment; // subtract as we go backwards time

        const str_dt = mDt.toISOString();
        mDt.subtract(2, "minute");

        await pool.query(
            "insert into sensor_data (id, value, dt) values ($1, $2, $3)",
            [
                TEST_SENSOR_ID_COUNTER,
                value,
                str_dt
            ]
        );
        console.log(`Did INSERT of sensor (${TEST_SENSOR_ID_COUNTER})`);
    }
}

const buildEntireSchema = async (): Promise<void> => {
    console.log("Creating entire database schema...");
    await executeSQLFile(`complete_v${TARGET_DATABASE_VERSION}.sql`)
    if (process.env.NODE_ENV === "development") {
        console.log("NODE_ENV is set to development so injecting test data in database...");
        await executeSQLFile("testdata.sql");
        await addProgrammaticTestData();
    }
}

const updateSchemaVersion_1to2 = (): Promise<void> => {
    return Promise.resolve();
}

const updateSchemaVersion_2to3 = (): Promise<void> => {
    console.log("Updating database schema from version 2 to 3...");
    return executeSQLFile("version_2_to_3.sql");
}

const updateSchemaVersion_3to4 = (): Promise<void> => {
    console.log("Updating database schema from version 3 to 4...");
    return executeSQLFile("version_3_to_4.sql");
}

const updateSchemaVersion_4to5 = (): Promise<void> => {
    console.log("Updating database schema from version 4 to 5...");
    return executeSQLFile("version_4_to_5.sql");
}

const updateSchemaVersion_5to6 = (): Promise<void> => {
    console.log("Updating database schema from version 5 to 6...");
    return executeSQLFile("version_5_to_6.sql");
}

const updateSchemaVersion_6to7 = (): Promise<void> => {
    console.log("Updating database schema from version 6 to 7...");
    return executeSQLFile("version_6_to_7.sql");
}

const updateSchemaVersion_7to8 = (): Promise<void> => {
    console.log("Updating database schema from version 7 to 8...");
    return executeSQLFile("version_7_to_8.sql");
}

const updateSchemaVersion_8to9 = (): Promise<void> => {
    console.log("Updating database schema from version 8 to 9...");
    return executeSQLFile("version_8_to_9.sql");
}

const updateSchemaVersion_9to10 = (): Promise<void> => {
    console.log("Updating database schema from version 9 to 10...");
    return executeSQLFile("version_9_to_10.sql");
};

const updateSchemaVersion_10to11 = (): Promise<void> => {
    console.log("Updating database schema from version 10 to 11...");
    return executeSQLFile("version_10_to_11.sql");
};

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
                } else if (version === 5) {
                    return updateSchemaVersion_5to6();
                } else if (version === 6) {
                    return updateSchemaVersion_6to7();
                } else if (version === 7) {
                    return updateSchemaVersion_7to8();
                } else if (version === 8) {
                    return updateSchemaVersion_8to9();
                } else if (version === 9) {
                    return updateSchemaVersion_9to10();
                    } else if (version === 10) {
                    return updateSchemaVersion_10to11();
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
