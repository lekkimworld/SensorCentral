const isTest = (process.env.NODE_ENV !== 'production' || false)
const isProd = (process.env.NODE_ENV === 'production' || false)

export const constants = {
    'DEFAULTS': {
        'SERVICE': {
            'LOOKUP_TIMEOUT': 50
        },
        'WATCHDOG': {
            'DEFAULT_TIMEOUT': (process.env.WATCHDOG_INTERVAL ? Number.parseInt(process.env.WATCHDOG_INTERVAL) : 10*60*1000) as number
        },
        'REDIS': {
            'DEVICE_EXPIRATION': (process.env.REDIS_DEVICE_EXPIRATION ? Number.parseInt(process.env.REDIS_DEVICE_EXPIRATION) : 10 * 60) as number,
            'SENSOR_EXPIRATION': (process.env.REDIS_SENSOR_EXPIRATION ? Number.parseInt(process.env.REDIS_SENSOR_EXPIRATION) : 10 * 60) as number
        },
        'TIMEZONE': process.env.TIMEZONE || 'Europe/Copenhagen',
        'DATETIME_FORMAT': process.env.DATETIME_FORMAT || "D-M-YYYY [kl.] k:mm"
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
