const graphqlEnablePlayground = process.env.NODE_ENV === "development" || process.env.GRAPHQL_ENABLE_PLAYGROUND !== undefined;

const JWT = {
    "OUR_ISSUER": "https://sensorcentral.heisterberg.dk",
    "ISSUERS": process.env.API_JWT_ISSUER ? [process.env.API_JWT_ISSUER as string] : ["https://sensorcentral.heisterberg.dk"],
    "AUDIENCE": process.env.API_JWT_AUDIENCE ? process.env.API_JWT_AUDIENCE as string : "https://sensorcentral.heisterberg.dk",
    "SCOPE_API": "api",                 // base api access
    "SCOPE_SENSORDATA": "sensordata",   // post sensordata
    "SCOPE_READ": "read",               // allow reading of data through api
    "SCOPE_ADMIN": "admin",             // allow crud of houses, devices etc.
    "SCOPE_ADMIN_JWT": "jwt"            // allows issuance of JWT's
}

export default {
    "APP": {
        "NAME": process.env.NODE_ENV === "development" ? "SensorCentral (DEV)" : process.env.NODE_ENV === "staging" ? "SensorCentral (STAGING)" : "SensorCentral",
        "PROTOCOL": process.env.APP_PROTOCOL || "https",
        "DOMAIN": process.env.APP_DOMAIN
    },
    "SMARTME": {
        "CUTOFF_YEAR": process.env.SMARTME_CUTOFF_YEAR || 2015,
        "ENCRYPTION_KEY": process.env.SMARTME_KEY as string
    },
    'DEFAULTS': {
        'SERVICE': {
            'LOOKUP_TIMEOUT': process.env.SERVICE_LOOKUP_TIMEOUT ? Number.parseInt(process.env.SERVICE_LOOKUP_TIMEOUT) : 2000
        },
        'WATCHDOG': {
            'DEFAULT_TIMEOUT': (process.env.WATCHDOG_INTERVAL ? Number.parseInt(process.env.WATCHDOG_INTERVAL) : 10 * 60 * 1000) as number
        },
        'REDIS': {
            'DEVICE_EXPIRATION_SECS': (process.env.REDIS_DEVICE_EXPIRATION_SECS ? Number.parseInt(process.env.REDIS_DEVICE_EXPIRATION_SECS) : 20 * 60) as number,
            'SENSOR_EXPIRATION_SECS': (process.env.REDIS_SENSOR_EXPIRATION_SECS ? Number.parseInt(process.env.REDIS_SENSOR_EXPIRATION_SECS) : 20 * 60) as number,
            'LOGINUSER_EXPIRATION_SECS': (process.env.REDIS_LOGINUSER_EXPIRATION_SECS ? Number.parseInt(process.env.REDIS_LOGINUSER_EXPIRATION_SECS) : 8 * 60 * 60) as number,
            'POWERDATA_EXPIRATION_SECS': (process.env.REDIS_POWERDATA_EXPIRATION_SECS ? Number.parseInt(process.env.REDIS_POWERDATA_EXPIRATION_SECS) : 12 * 60 * 60) as number
        },
        "NOTIFY": {
            "DEVICE": {
                "RESET": {
                    "TITLE": process.env.DEVICE_RESET_TITLE || "{{appname}} - Device watchdog",
                    "MESSAGE": process.env.DEVICE_RESET_MESSAGE || "{{appname}} - Watchdog for device ({{device.id}} / {{device.name}}) reset meaning we received no communication from it in {{timeout.ms}} ms ({{timeout.minutes}} minutes) {{appurl}}/#configuration/house/{{device.house.id}}/device/{{device.id}}"
                },
                "RESTART": {
                    "TITLE": process.env.DEVICE_RESTART_TITLE || "{{appname}} - Device restart",
                    "MESSAGE": process.env.DEVICE_RESTART_MESSAGE || "{{appname}} - Device restart ({{device.id}} / {{device.name}}) - maybe it didn't pat the watchdog? {{appurl}}/#configuration/house/{{device.house.id}}/device/{{device.id}}"
                },
                "NOSENSORS": {
                    "TITLE": process.env.DEVICE_NOSENSORS_TITLE || "{{appname}} - Device pinged without any sensors",
                    "MESSAGE": process.env.DEVICE_NOSENSORS_MESSAGE || "{{appname}} - Device ({{device.id}} / {{device.name}}) pinged without any sensors in the data - maybe the sensor is not plugged in? {{appurl}}/#configuration/house/{{device.house.id}}/device/{{device.id}}"
                }
            }
        },
        'TIMEZONE': process.env.TIMEZONE || 'Europe/Copenhagen',
        'DATETIME_FORMAT': process.env.DATETIME_FORMAT || "D-M-YYYY [kl.] k:mm",
        "GRAPHQL_ENABLE_PLAYGROUND": graphqlEnablePlayground,
        "SESSION_TIMEOUT_SECONDS": process.env.SESSION_TIMEOUT_SECONDS ? Number.parseInt(process.env.SESSION_TIMEOUT_SECONDS) : (graphqlEnablePlayground ? (1 * 60 * 60) : 300), // 1 hour in development, 300 seconds in prod
        "JWT": {
            "USER_SCOPES": [JWT.SCOPE_ADMIN, JWT.SCOPE_API, JWT.SCOPE_ADMIN_JWT, JWT.SCOPE_SENSORDATA],
            "DEVICE_SCOPES": [JWT.SCOPE_API, JWT.SCOPE_SENSORDATA]
        },
        "NORDPOOL": {
            "CURRENCY": "DKK",
            "AREA": "DK2"
        }
    },
    JWT,
    "GOOGLE": {
        "PRIVATE_KEY": process.env.GOOGLE_PRIVATE_KEY as string,
        "SCOPES": ["https://www.googleapis.com/auth/gmail.send"],
        "JWT_EXPIRATION_MINUTES": 5,
        "TOKEN_URI": process.env.GOOGLE_TOKEN_URI as string,
        "SERVICE_ACCOUNT_EMAIL": process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL as string
    },
    'QUEUES': {
        'SENSOR': 'rawSensorReading',
        'DEVICE': 'rawDeviceReading',
        "CONTROL": "controlMessageQueue"
    },
    "TOPICS": {
        'CONTROL': 'controlMessageTopic',
        'SENSOR': 'augmentedSensorReading',
        'DEVICE': 'augmentedDeviceReading'
    },
    'SENSOR_VALUES': {
        'MAX_REGISTER_TEMP': 60,
        'MIN_REGISTER_TEMP': -60
    },
    'SENSOR_DENOMINATORS': {
        "temp": "\u00B0C",
        "hum": "%",
        "unknown": "(??)"
    }
}
