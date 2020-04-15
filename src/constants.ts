export const constants = {
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
        'TIMEZONE': process.env.TIMEZONE || 'Europe/Copenhagen',
        'DATETIME_FORMAT': process.env.DATETIME_FORMAT || "D-M-YYYY [kl.] k:mm",
        "SESSION_TIMEOUT_HOURS": 1,
        "API": {
            "JWT": {
                "OUR_ISSUER": "https://sensorcentral.heisterberg.dk",
                "ISSUERS": process.env.API_JWT_ISSUER ? [process.env.API_JWT_ISSUER as string] : ["https://sensorcentral.heisterberg.dk"],
                "AUDIENCE": process.env.API_JWT_AUDIENCE ? process.env.API_JWT_AUDIENCE as string : "https://sensorcentral.heisterberg.dk",
                "SCOPE_API": "api",                 // base api access
                "SCOPE_SENSORDATA": "sensordata",   // post sensordata
                "SCOPE_READ": "read",               // allow reading of data through api
                "SCOPE_ADMIN": "admin",             // allow crud of houses, devices etc.
                "SCOPE_ADMIN_JWT": "jwt"            // allows issuance of JWT's
            }
        }
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
