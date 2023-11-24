import { Pool, PoolConfig } from "pg";
import { config as dotenv_config} from "dotenv";
import constants from "../constants";
import * as fs from "fs";
import { join } from "path";
import * as readline from "readline";
import moment from "moment-timezone";
import { Logger } from "../logger";
import {objectHasOwnProperty_Trueish} from "../utils";

// read config
dotenv_config();

// get log
const logger = new Logger("database-init-utils");

const TARGET_DATABASE_VERSION = 14;

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

const pool = new Pool(config);

const executeSQLFile = (filename: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const lines: string[] = [];

        readline.createInterface({
            "input": fs.createReadStream(join(__dirname, "..", "..", "schema", filename))
        }).on("line", line => {
            if (!line || line.trim().length === 0) return;
            logger.debug(`[SQL] Adding line: ${line}`);
            lines.push(line);

        }).on("close", () => {
            const sqldata = lines.join("");
            logger.info(`[SQL] Executing SQL commands`);
            pool.query(sqldata).then(() => resolve()).catch(err => {
                reject(err);
            })
        })
    })
}

const TEST_SENSOR_ID_GAUGE = "mysensor_5-1";
const TEST_SENSOR_ID_DELTA1 = "mysensor_3-1"; // scalefactor 1/1000 = 0.001
const TEST_SENSOR_ID_DELTA2 = "mysensor_3-2"; // scalefactor 1/1000 = 0.001
const TEST_SENSOR_ID_COUNTER = "94f7a0f4-d85b-4815-9c77-833be7c28779"; // scalefactor 1/500 = 0.002

const addProgrammaticTestData = async (): Promise<void> => {
    // add for delta sensor
    logger.info("addProgrammaticTestData_Gauge()");
    await addProgrammaticTestData_Gauge();

    // add for delta sensor
    logger.info("addProgrammaticTestData_Delta");
    await addProgrammaticTestData_Delta(TEST_SENSOR_ID_DELTA1);
    await addProgrammaticTestData_Delta(TEST_SENSOR_ID_DELTA2);

    // add for counter sensor
    logger.info("addProgrammaticTestData_Counter");
    await addProgrammaticTestData_Counter();
}

const addProgrammaticTestData_Gauge = async (): Promise<void> => {
    const mDt = moment().tz(constants.DEFAULTS.TIMEZONE).set("hours", 12).set("minute", 0).set("second", 0);
    const mEnd = moment(mDt).subtract(48, "hour");

    logger.info("Get client");
    const client = await pool.connect();
    logger.info("Got client");
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
        logger.info(`Did INSERT of sensor (${TEST_SENSOR_ID_GAUGE})`);
    }
    client.release();
    logger.info("Released client");
}

const addProgrammaticTestData_Delta = async (sensorId: string): Promise<void> => {
    const mDt = moment().tz(constants.DEFAULTS.TIMEZONE).set("hours", 12).set("minute", 0).set("second", 0);
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
        logger.info(`Did INSERT of sensor (${sensorId})`);
    }
}

const addProgrammaticTestData_Counter = async (): Promise<void> => {
    const mDt = moment().tz(constants.DEFAULTS.TIMEZONE).set("hours", 12).set("minute", 0).set("second", 0);
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
        logger.info(`Did INSERT of sensor (${TEST_SENSOR_ID_COUNTER})`);
    }
}

const buildEntireSchema = async (): Promise<void> => {
    logger.info("Creating entire database schema...");
    await executeSQLFile(`complete_v${TARGET_DATABASE_VERSION}.sql`)
    if (process.env.NODE_ENV === "development") {
        logger.info("NODE_ENV is set to development so injecting test data in database...");
        await executeSQLFile("testdata.sql");
        await addProgrammaticTestData();
    }
}

const updateSchemaVersion = (source: number, target: number): Promise<void> => {
    logger.info(`Updating database schema from version ${source} to ${target}...`);
    return executeSQLFile(`version_${source}_to_${target}.sql`);
};

export default (processExit: boolean) : Promise<void> => {
    return pool.query("BEGIN")
        .then(() => {
            // query for database_version table
            return pool.query(`select * from information_schema.tables where table_name='database_version'`);
        })
        .then((result) => {
            if (result.rowCount === 0) {
                // no database_version table exists - create entire schema
                logger.info("No database_version table exists in schema - create entire schema");
                return buildEntireSchema();
            } else {
                // check version of database
                return pool.query("select version from database_version").then((result) => {
                    if (result.rowCount === 0) {
                        // no rows in version table - create entire schema
                        logger.info("No rows in database_version table - create entire schema");
                        return buildEntireSchema();
                    } else {
                        // get version from database
                        let version = result.rows[0].version;
                        return new Promise<void>(async (resolve) => {
                            // loop until at latest version
                            while (version < TARGET_DATABASE_VERSION) {
                                logger.info(`Database is at version <${version}> - target is <${TARGET_DATABASE_VERSION}> - run script`);
                                await updateSchemaVersion(version, version+1);

                                // increment
                                version++;
                            }

                            logger.info("We are at the newest version...");
                            resolve();
                        })
                    }
                });
            }
        })
        .then(() => {
            if (objectHasOwnProperty_Trueish(process.env, "DATABASE_ALWAYS_ROLLBACK_SCHEMA_UPGRADE")) {
                logger.info(
                    `DATABASE_ALWAYS_ROLLBACK_SCHEMA_UPGRADE set - aborting schema upgrade- throwing exception...`
                );
                throw new Error(`DATABASE_ALWAYS_ROLLBACK_SCHEMA_UPGRADE set - aborting schema upgrade`);
            }
            logger.info("Committing...");
            return Promise.all([Promise.resolve(0), pool.query("COMMIT")]);
        })
        .catch((err) => {
            logger.info("!! ERRROR !!");
            logger.info(err.message);
            logger.info("!! ROLLING BACK !!");
            return Promise.all([Promise.resolve(1), pool.query("ROLLBACK")]);
        })
        .finally(() => {
            pool.end();
        })
        .then((data) => {
            logger.info(`Done... (return code is ${data[0]})`);
            if (processExit) process.exit(data[0] as number);
        });
};
