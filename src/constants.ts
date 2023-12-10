import { DEBUG, ERROR, INFO, Level, TRACE, WARN } from "./logger";

export const ISO8601_DATETIME_FORMAT = "YYYY-MM-DDTHH:mm:ss.SSS[Z]";

const JWT = {
    "OUR_ISSUER": "https://sensorcentral.heisterberg.dk",
    "ISSUERS": process.env.API_JWT_ISSUER ? [process.env.API_JWT_ISSUER] : ["https://sensorcentral.heisterberg.dk"],
    "AUDIENCE": process.env.API_JWT_AUDIENCE ? process.env.API_JWT_AUDIENCE : "https://sensorcentral.heisterberg.dk",
    "SCOPE_API": "api",                 // base access, required for any access
    "SCOPE_SENSORDATA": "sensordata",   // post sensordata, required to post sensor data
    "SCOPE_READ": "read",               // allow reading of data
    "SCOPE_ADMIN": "admin",             // allow create, update, delete of houses, devices etc. Does NOT automatically imply read.
    "SCOPE_ADMIN_JWT": "jwt",            // allows issuance of JWT's,
    ALL_SCOPES: [] as string[]
}
JWT.ALL_SCOPES.push(...[JWT.SCOPE_ADMIN, JWT.SCOPE_ADMIN_JWT, JWT.SCOPE_API, JWT.SCOPE_READ, JWT.SCOPE_SENSORDATA]);

const stringToLogLevel = (level: string | undefined) : Level | undefined => {
    if (level && "trace" === level.toLowerCase()) return TRACE;
    if (level && "debug" === level.toLowerCase()) return DEBUG;
    if (level && "info" === level.toLowerCase()) return INFO;
    if (level && "warn" === level.toLowerCase()) return WARN;
    if (level && "ERROR" === level.toLowerCase()) return ERROR;
    return undefined;
}
const log_level: Level = stringToLogLevel(process.env.LOG_LEVEL) || INFO;

export default {
    APP: {
        LOG_LEVEL: (svc?: string) => {
            if (!svc) return log_level;
            let srvc_level = process.env[`LOG_LEVEL_${svc.toUpperCase()}`];
            if (!srvc_level) {
                // no specific config - look in LOG_LEVEL_SERVICES
                const log_level_services = process.env.LOG_LEVEL_LOGGERS;
                if (!log_level_services) {
                    // return default log level
                    return log_level;
                }

                log_level_services.split(",").forEach((elem) => {
                    if (srvc_level) return;
                    const parts = elem.split("=");
                    if (parts.length !== 2) return;
                    if (parts[0].toUpperCase() === svc.toUpperCase()) {
                        srvc_level = parts[1];
                    }
                });
                if (!srvc_level) {
                    // no custom level found - return default level
                    return log_level;
                }
            }

            // convert level
            const l = stringToLogLevel(srvc_level);
            if (!l) {
                console.log(
                    `WARNING --- unknown log level specified for service <${svc}> - defaulting to ${log_level.name}`
                );
                return log_level;
            }
            return l;
        },
        NAME:
            process.env.NODE_ENV === "development"
                ? "SensorCentral (DEV)"
                : process.env.NODE_ENV === "staging"
                ? "SensorCentral (STAGING)"
                : "SensorCentral",
        PROTOCOL: process.env.APP_PROTOCOL || "https",
        DOMAIN: process.env.APP_DOMAIN,
        NO_PROD_TLS: process.env.APP_NO_PROD_TLS && process.env.APP_NO_PROD_TLS.substring(0, 1) === "t" ? true : false,
        GITCOMMIT: process.env.APP_GITCOMMIT || "n_a",
        TITLE: process.env.APP_TITLE || "SensorCentral"
    },
    HTTP_CONTEXT: {
        REQUEST_ID: "requestId",
    },
    SMARTME: {
        CUTOFF_YEAR: process.env.SMARTME_CUTOFF_YEAR || 2015,
        PAYLOAD_SEPARATOR: ":",
        SIGNATURE_ALGORITHM: "sha256",
        ENCRYPTION_KEY: process.env.SMARTME_KEY as string,
        PROTOCOL: process.env.SMARTME_PROTOCOL || "https",
        DOMAIN: process.env.SMARTME_DOMAIN || "api.smart-me.com",
    },
    ALERT: {
        TIMEOUT_BINARY_SENSOR: (process.env.ALERTS_TIMEOUT_BINARY_SENSOR
            ? Number.parseInt(process.env.ALERTS_TIMEOUT_BINARY_SENSOR)
            : 10 * 60 * 1000) as number,
    },
    NOTIFY: {
        SENSOR: {
            TIMEOUT: {
                TITLE: process.env.TEMPL_TITLE_SENSOR_TIMEOUT || "{{app.name}} - Sensor watchdog",
                MESSAGE:
                    process.env.TEMPL_MSG_SENSOR_TIMEOUT ||
                    "{{app.name}} - Watchdog for sensor ({{sensor.id}} / {{sensor.name}}) reset meaning we received no communication from it in {{data.timeout.minutes}} minutes ({{data.timeout.seconds}} seconds, {{data.timeout.milliseconds}} ms) {{url.target}}",
            },
            VALUE: {
                TITLE: process.env.TEMPL_TITLE_SENSOR_VALUE || "{{app.name}} - Sensor value",
                MESSAGE:
                    process.env.TEMPL_MSG_SENSOR_VALUE ||
                    "{{app.name}} - Value for sensor ({{sensor.id}} / {{sensor.name}}) is {{data.value}} {{url.target}} {{url.app}}",
            },
        },
        DEVICE: {
            TIMEOUT: {
                TITLE: process.env.TEMPL_TITLE_DEVICE_TIMEOUT || "{{app.name}} - Device watchdog",
                MESSAGE:
                    process.env.TEMPL_MSG_DEVICE_TIMEOUT ||
                    "{{app.name}} - Watchdog for device ({{device.id}} / {{device.name}}) reset meaning we received no communication from it in {{data.timeout.minutes}} minutes ({{data.timeout.milliseconds}} ms) {{url.target}}",
            },
            RESTART: {
                TITLE: process.env.TEMPL_TITLE_DEVICE_RESTART || "{{app.name}} - Device restart",
                MESSAGE:
                    process.env.TEMPL_MSG_DEVICE_RESTART ||
                    "{{app.name}} - Device restart ({{device.id}} / {{device.name}}) - maybe it didn't pat the watchdog? {{url.target}}",
            },
            NOSENSORS: {
                TITLE: process.env.TEMPL_TITLE_DEVICE_NOSENSORS || "{{app.name}} - Device pinged without any sensors",
                MESSAGE:
                    process.env.TEMPL_MSG_DEVICE_NOSENSORS ||
                    "{{app.name}} - Device ({{device.id}} / {{device.name}}) pinged without any sensors in the data - maybe the sensor is not plugged in? {{url.target}}",
            },
        },
    },
    DEFAULTS: {
        SERVICE: {
            LOOKUP_TIMEOUT: process.env.SERVICE_LOOKUP_TIMEOUT
                ? Number.parseInt(process.env.SERVICE_LOOKUP_TIMEOUT)
                : 20000,
        },
        REDIS: {
            DEVICE_EXPIRATION_SECS: (process.env.REDIS_DEVICE_EXPIRATION_SECS
                ? Number.parseInt(process.env.REDIS_DEVICE_EXPIRATION_SECS)
                : 20 * 60) as number,
            SENSOR_EXPIRATION_SECS: (process.env.REDIS_SENSOR_EXPIRATION_SECS
                ? Number.parseInt(process.env.REDIS_SENSOR_EXPIRATION_SECS)
                : 20 * 60) as number,
            LOGINUSER_EXPIRATION_SECS: (process.env.REDIS_LOGINUSER_EXPIRATION_SECS
                ? Number.parseInt(process.env.REDIS_LOGINUSER_EXPIRATION_SECS)
                : 8 * 60 * 60) as number,
            POWERDATA_EXPIRATION_SECS: (process.env.REDIS_POWERDATA_EXPIRATION_SECS
                ? Number.parseInt(process.env.REDIS_POWERDATA_EXPIRATION_SECS)
                : 7 * 24 * 60 * 60) as number,
        },
        TIMEZONE: process.env.TIMEZONE || "Europe/Copenhagen",
        DATETIME_FORMAT: process.env.DATETIME_FORMAT || "D-M-YYYY [kl.] k:mm",
        SESSION_TIMEOUT_SECONDS: process.env.SESSION_TIMEOUT_SECONDS
            ? Number.parseInt(process.env.SESSION_TIMEOUT_SECONDS)
            : 300, //default 300 seconds in prod
        JWT: {
            USER_SCOPES: [JWT.SCOPE_API, JWT.SCOPE_READ, JWT.SCOPE_ADMIN, JWT.SCOPE_ADMIN_JWT, JWT.SCOPE_SENSORDATA],
            DEVICE_SCOPES: [JWT.SCOPE_API, JWT.SCOPE_SENSORDATA],
        },
        NORDPOOL: {
            CURRENCY: "DKK",
            AREA: "DK2",
        },
        GRAPHQL: {
            PATH: process.env.GRAPHQL_PATH || "/graphql",
        },
    },
    JWT,
    GOOGLE: {
        PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY as string,
        SCOPES: ["https://www.googleapis.com/auth/gmail.send"],
        JWT_EXPIRATION_MINUTES: 5,
        TOKEN_URI: process.env.GOOGLE_TOKEN_URI as string,
        SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL as string,
    },
    QUEUES: {
        SENSOR: "rawSensorReading",
        DEVICE: "rawDeviceReading",
        CONTROL: "controlMessageQueue",
        NOTIFY: "notify",
    },
    TOPICS: {
        CONTROL: "controlMessageTopic",
        SENSOR: "augmentedSensorReading",
        DEVICE: "augmentedDeviceReading",
    },
    SENSOR_VALUES: {
        MAX_REGISTER_TEMP: 60,
        MIN_REGISTER_TEMP: -60,
    },
    SENSOR_DENOMINATORS: {
        temp: "\u00B0C",
        hum: "%",
        unknown: "(??)",
    },
};
