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
    'DEFAULTS': {
        'SERVICE': {
            'LOOKUP_TIMEOUT': 2000
        },
        'WATCHDOG': {
            'DEFAULT_TIMEOUT': (process.env.WATCHDOG_INTERVAL ? Number.parseInt(process.env.WATCHDOG_INTERVAL) : 10*60*1000) as number
        },
        'REDIS': {
            'DEVICE_EXPIRATION': (process.env.REDIS_DEVICE_EXPIRATION ? Number.parseInt(process.env.REDIS_DEVICE_EXPIRATION) : 10 * 60) as number,
            'SENSOR_EXPIRATION': (process.env.REDIS_SENSOR_EXPIRATION ? Number.parseInt(process.env.REDIS_SENSOR_EXPIRATION) : 10 * 60) as number
        },
        "NOTIFY": {
            "DEVICE": {
                "RESET": {
                    "TITLE": process.env.DEVICE_RESET_TITLE || "SensorCentral - Device watchdog ({{device.name}})",
                    "MESSAGE": process.env.DEVICE_RESET_MESSAGE || "SensorCentral - Watchdog for device ({{device.id}} / {{device.name}}) reset meaning we received no communication from it in {{timeout.ms}} ms ({{timeout.minutes}} minutes)"
                },
                "RESTART": {
                    "TITLE": process.env.DEVICE_RESTART_TITLE || "SensorCentral - Device ({{device.name}}) restart",
                    "MESSAGE" : process.env.DEVICE_RESTART_MESSAGE || "SensorCentral - Device restart ({{device.id}} / {{device.name}}) - maybe it didn't pat the watchdog?"
                }
            }
        },
        'TIMEZONE': process.env.TIMEZONE || 'Europe/Copenhagen',
        'DATETIME_FORMAT': process.env.DATETIME_FORMAT || "D-M-YYYY [kl.] k:mm",
        "GRAPHQL_ENABLE_PLAYGROUND": graphqlEnablePlayground,
        "SESSION_TIMEOUT_SECONDS": process.env.SESSION_TIMEOUT_SECONDS ? Number.parseInt(process.env.SESSION_TIMEOUT_SECONDS) : (graphqlEnablePlayground ? (1*60*60) : 300), // 1 hour in development, 300 seconds in prod
        "JWT": {
            "USER_SCOPES": [JWT.SCOPE_ADMIN, JWT.SCOPE_API, JWT.SCOPE_ADMIN_JWT, JWT.SCOPE_SENSORDATA],
            "DEVICE_SCOPES": [JWT.SCOPE_API, JWT.SCOPE_SENSORDATA]
        },
        "GOOGLE": {
            "JWT_EXPIRATION_MINUTES": 5
        }
    },
    JWT,
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
