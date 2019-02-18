const isTest = (process.env.NODE_ENV !== 'production' || false)
const isProd = (process.env.NODE_ENV === 'production' || false)

module.exports = {
    'DEFAULTS': {
        'SERVICE': {
            'LOOKUP_TIMEOUT': 50
        },
        'WATCHDOG': {
            'DEFAULT_TIMEOUT': process.env.WATCHDOG_INTERVAL || 10*60*1000
        },
        'REDIS': {
            'DEVICE_EXPIRATION': process.env.REDIS_DEVICE_EXPIRATION || 10 * 60,
            'SENSOR_EXPIRATION': process.env.REDIS_SENSOR_EXPIRATION || 10 * 60
        }
    },
    'PUBNUB': {
        'RAW_SENSORREADING_CHANNEL': 'rawSensorReading',
        'RAW_DEVICEREADING_CHANNEL': 'rawDeviceReading',
        'AUG_CHANNEL': 'augmentedSensorReading',
        'CTRL_CHANNEL': 'controlMessage'
    },
    'SENSOR_VALUES': {
        'MAX_REGISTER_TEMP': 60,
        'MIN_REGISTER_TEMP': -60
    },
    'SENSOR_TYPES': {
        "TEMPERATURE": {
            "type": "temp",
            "denominator": "\u00B0C"
        },
        "HUMIDITY": {
            "type": "hum",
            "denominator": "%"
        },
        "UNKNOWN": {
            "type": "unknown",
            "denominator": "(??)"
        }
    }
}
