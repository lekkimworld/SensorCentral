const isTest = (process.env.NODE_ENV !== 'production' || false)
const isProd = (process.env.NODE_ENV === 'production' || false)

module.exports = {
    'DEFAULTS': {
        'SERVICE': {
            'LOOKUP_TIMEOUT': 50
        }
    },
    'PUBNUB': {
        'RAW_CHANNEL_NAME': 'rawSensorReading',
        'AUG_CHANNEL_NAME': 'augmentedSensorReading',
        'CTRL_CHANNEL_NAME': 'controlMessage'
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
