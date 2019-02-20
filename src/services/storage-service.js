const util = require('util')
const constants = require('../constants.js')
const {BaseService} = require('../configure-services.js')
const redis = require('redis');
const {promisify} = require('util');

const SENSOR_KEY_PREFIX = 'sensor:';
const DEVICE_KEY_PREFIX = 'device:';

const StorageService = function() {
    this.name = 'storage'
    this.dependencies = ['db', 'log', 'event']

    // create redis instance
    this._redisClient = this._buildRedisClient();
        
    this._createRedisSensorKey = (sensor) => {
        if (!sensor || !sensor.sensorId) return undefined;
        return `${SENSOR_KEY_PREFIX}${sensor.sensorId}`;
    }
    this._createRedisDeviceKey = (device) => {
        if (!device || !device.deviceId) return undefined;
        return `${DEVICE_KEY_PREFIX}${device.deviceId}`;
    }
    this._setObject = (key, obj, expirationTime) => {
        const serializedValue = typeof obj === 'object' ? JSON.stringify(obj) : obj;
        if (expirationTime && typeof expirationTime === 'number') {
            return this._redisClient.setex(key, expirationTime, serializedValue).then(() => {
                return Promise.resolve(obj);
            })
        } else {
            return this._redisClient.set(key, serializedValue).then(() => {
                return Promise.resolve(obj);
            })
        }
    }
    this._getObject = (key) => {
        return this._redisClient.get(key).then(serializedValue => {
            if (!serializedValue) return Promise.resolve(undefined);
            try {
                let obj = JSON.parse(serializedValue);
                if (obj.hasOwnProperty('sensorDt') && obj.sensorDt) obj.sensorDt = new Date(obj.sensorDt)
                return Promise.resolve(obj);
            } catch (e) {
                return Promise.resolve(serializedValue);
            }
        })
    }
}
util.inherits(StorageService, BaseService)
StorageService.prototype._buildRedisClient = function() {
    const client = redis.createClient({
        'url': process.env.REDIS_URL
    });
    return {
        'get': promisify(client.get).bind(client),
        'set': promisify(client.set).bind(client),
        'setex': promisify(client.setex).bind(client),
        'keys': promisify(client.keys).bind(client),
        'mget': promisify(client.mget).bind(client),
        'expire': promisify(client.expire).bind(client)
    }
}
StorageService.prototype.init = function(callback, dbSvc, logSvc, eventSvc) {
    const getOrCreateDevice = (obj) => {
        const key = this._createRedisDeviceKey(obj);
        if (!key) return Promise.reject('No device supplied or unable to compute device key');

        // try and get it
        return this._getObject(key).then(device => {
            if (!device) {
                // set
                return this._setObject(key, {
                    'deviceId': obj.deviceId,
                    'deviceName': obj.deviceName,
                    'restarts': 0,
                    'watchdogResets': 0
                }, constants.DEFAULTS.REDIS.DEVICE_EXPIRATION)
            } else {
                return Promise.resolve(device);
            }
        })
    }
    const getOrCreateSensor = (obj) => {
        const key = this._createRedisSensorKey(obj);
        if (!key) return Promise.reject('No sensor supplied or unable to compute sensor key');

        return this._getObject(key).then(sensor => {
            if (!sensor) {
                return getOrCreateDevice(obj).then(device => {
                    return this._setObject(key, {
                        'sensorName': obj.sensorName,
                        'sensorLabel': obj.sensorLabel,
                        'sensorId': obj.sensorId,
                        'sensorType': obj.sensorType,
                        'sensorValue': obj.sensorValue || Number.MIN_VALUE, 
                        'sensorDt': obj.sensorDt || undefined, 
                        'device': device
                    }, constants.DEFAULTS.REDIS.SENSOR_EXPIRATION)
                })
            } else {
                return Promise.resolve(sensor);
            }
        })
    }

    // get the sensors we care about from the db
    let promiseCancelled = false;
    dbSvc.query("select s.id sensorId, s.name sensorName, s.label sensorLabel, s.type sensorType, d.id deviceId, d.name deviceName from sensor s, device d where s.deviceId=d.id").then(rs => {
        return Promise.all(rs.rows.map(row => getOrCreateSensor({
                'sensorId': row.sensorid,
                'sensorName': row.sensorname, 
                'sensorLabel': row.sensorlabel,
                'sensorType': row.sensortype,
                'deviceId': row.deviceid, 
                'deviceName': row.devicename
            })
        ))
    }).catch(err => {
        logSvc.error('Storage service is unable to make database query', err);
        promiseCancelled = true;
        return callback(err);
    }).then(sensors => {
        // check for cancellation
        if (promiseCancelled) return;

        // listen for events and keep last event data around for each sensor
        eventSvc.subscribe([constants.PUBNUB.AUG_CHANNEL, constants.PUBNUB.CTRL_CHANNEL, constants.PUBNUB.RAW_DEVICEREADING_CHANNEL], (channel, obj) => {
            logSvc.debug(`Storage service received message on ${channel} channel with payload ${JSON.stringify(obj)}`)
            if (channel === constants.PUBNUB.CTRL_CHANNEL) {
                // control channel
                getOrCreateDevice(obj).then(device => {
                    if (obj.hasOwnProperty("restart") && obj.restart === true) {
                        // increment restarts
                        device.restarts += 1
                    } else if (obj.hasOwnProperty('watchdogReset') && obj.watchdogReset === true) {
                        // increment watchdog resets
                        device.watchdogResets += 1
                    }

                    // store
                    return this._setObject(this._createRedisDeviceKey(device), device, constants.DEFAULTS.REDIS.DEVICE_EXPIRATION);

                }).then(device => {

                }).catch(err => {

                })

            } else if (channel === constants.PUBNUB.AUG_CHANNEL) {
                // sensor data - put in storage
                getOrCreateSensor(obj).then(sensor => {
                    // update sensor with value and last sensor dt
                    sensor.sensorValue = obj.sensorValue
                    sensor.sensorDt = new Date()
                    
                    // store
                    return this._setObject(this._createRedisSensorKey(sensor), sensor, constants.DEFAULTS.REDIS.SENSOR_EXPIRATION)

                }).catch(err => {
                    console.log(err)
                })
            } else if (channel === constants.PUBNUB.RAW_DEVICEREADING_CHANNEL) {
                // device data - sanity check for deviceId
                if (!obj.deviceId) return;

                // touch device record in Redis
                getOrCreateDevice(obj).then(device => {
                    // touch
                    return this._redisClient.expire(`${DEVICE_KEY_PREFIX}${device.deviceId}`, constants.DEFAULTS.REDIS.DEVICE_EXPIRATION);

                }).catch(err => {
                    console.log(err);
                })
            }
        })

        // callback
        callback()
        
    }).catch(err => {
        logSvc.error('Storage service is unable to make subscribe to event channel', err);
        promiseCancelled = true;
        return callback(err);
    })
}
StorageService.prototype.getSensors = function() {
    // get all sensor ids in redis
    return this._redisClient.keys(`${SENSOR_KEY_PREFIX}*`).then(keys => {
        // make sure there are keys
        if (!keys || !Array.isArray(keys) || !keys.length) return Promise.resolve([]);

        // get value for keys
        return this._redisClient.mget(keys);
    }).then(str_sensors => {
        if (!str_sensors || !Array.isArray(str_sensors) || !str_sensors.length) return Promise.resolve({})
        const sensors = str_sensors.map(str => JSON.parse(str)).reduce((prev, sensor) => {
            prev[sensor.sensorId] = sensor;
            return prev;
        }, {})
        return Promise.resolve(Object.freeze(sensors));
    })
}
StorageService.prototype.getSensorIds = function() {
    return this._redisClient.keys(`${SENSOR_KEY_PREFIX}*`).then(keys => {
        const sensorIds = keys.map(key => key.substring(SENSOR_KEY_PREFIX.length));
        return Promise.resolve(sensorIds);
    })
}
StorageService.prototype.getSensorById = function(sensorId) {
    return this._redisClient.get(`${SENSOR_KEY_PREFIX}${sensorId}`).then(str => {
        if (!str) return Promise.resolve(undefined);
        const sensor = JSON.parse(str);
        return Promise.resolve(sensor);
    })
}
StorageService.prototype.getDevices = function() {
    // get all device ids in redis
    return this._redisClient.keys(`${DEVICE_KEY_PREFIX}*`).then(keys => {
        // make sure there are keys
        if (!keys || !Array.isArray(keys) || !keys.length) return Promise.resolve([]);

        // get data for keys
        return this._redisClient.mget(keys)

    }).then(str_devices => {
        if (!str_devices || !Array.isArray(str_devices) || !str_devices.length) return Promise.resolve({})

        const devices = str_devices.map(str => JSON.parse(str)).reduce((prev, device) => {
            prev[device.deviceId] = device;
            return prev;
        }, {})
        return Promise.resolve(Object.freeze(devices));
    })
}
StorageService.prototype.getDeviceIds = function() {
    return this._redisClient.keys(`${DEVICE_KEY_PREFIX}*`).then(keys => {
        const deviceIds = keys.map(key => key.substring(DEVICE_KEY_PREFIX.length));
        return Promise.resolve(deviceIds);
    })
}
StorageService.prototype.getDeviceById = function(deviceId) {
    return this._redisClient.get(`${DEVICE_KEY_PREFIX}${deviceId}`).then(str => {
        if (!str) return Promise.resolve(undefined);
        const device = JSON.parse(str);
        return Promise.resolve(device);
    })
}
StorageService.prototype.getDeviceIdsForSensorsIds = function(sensorIds) {
    if (!sensorIds || !Array.isArray(sensorIds) || !sensorIds.length) return Promise.resolve([]);
    return this._redisClient.mget(sensorIds.filter(sensorId => sensorId && sensorId.length).map(sensorId => `${SENSOR_KEY_PREFIX}${sensorId}`)).then(sensors => {
        let deviceIds = sensors.reduce((prev, str_sensor) => {
            if (!str_sensor) return prev;
            try {
                let sensor = JSON.parse(str_sensor);
                if (sensor && sensor.device.deviceId) prev.add(sensor.device.deviceId);
            } catch (err) {}
            return prev;
        }, new Set());
        return Promise.resolve(Array.from(deviceIds));
    })
}
StorageService.prototype.terminate = function() {
    
}
module.exports = StorageService
