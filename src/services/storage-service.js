const util = require('util')
const constants = require('../constants.js')
const {BaseService} = require('../configure-services.js')

const _sensors = {}
const _devices = {}

const StorageService = function() {
    this.name = 'storage'
    this.dependencies = ['db', 'log', 'event']
}
util.inherits(StorageService, BaseService)
StorageService.prototype.init = function(callback, dbSvc, logSvc, eventSvc) {
    // get the sensors we care about from the db
    dbSvc.query("select s.id sensorId, s.name sensorName, s.label sensorLabel, s.type sensorType, d.id deviceId, d.name deviceName from sensor s, device d where s.deviceId=d.id").then(rs => {
        rs.rows.forEach(row => {
            let device = {
                'deviceId': row.deviceid,
                'deviceName': row.devicename,
                'restarts': 0,
                'watchdogResets': 0
            }
            _devices[row.deviceid] = device
            _sensors[row.sensorid] = {
                'sensorId': row.sensorid,
                'sensorName': row.sensorname, 
                'sensorLabel': row.sensorlabel,
                'sensorType': row.sensortype,
                'sensorValue': Number.MIN_VALUE, 
                'sensorDt': undefined, 
                'device': device
            }
        })
        
        // listen for events and keep last event data around for each sensor
        eventSvc.subscribe([constants.PUBNUB.AUG_CHANNEL, constants.PUBNUB.CTRL_CHANNEL], (channel, obj) => {
            logSvc.debug(`Storage service received message on ${channel} channel with payload ${JSON.stringify(obj)}`)
            if (channel === constants.PUBNUB.CTRL_CHANNEL) {
                // control channel
                const getOrCreateDevice = (obj) => {
                    let device = _devices[obj.deviceId]
                    if (!device) {
                        device = {
                            'deviceId': obj.deviceId,
                            'deviceName': undefined,
                            'restarts': 0,
                            'watchdogResets': 0
                        }
                        _devices[obj.deviceId] = device
                    }
                    return device
                }
                let device = getOrCreateDevice(obj)

                if (obj.hasOwnProperty("restart") && obj.restart === true) {
                    // increment restarts
                    device.restarts += 1
                } else if (obj.hasOwnProperty('watchdogReset') && obj.watchdogReset === true) {
                    // increment watchdog resets
                    device.watchdogResets += 1
                }

            } else if (channel === constants.PUBNUB.AUG_CHANNEL) {
                // sensor data - put in storage
                let storageObj = _sensors[obj.sensorId]
                if (!storageObj) {
                    // we do now know a sensor with this id (i.e. it's not in the db) - create it
                    let device = _devices[obj.deviceId]
                    if (!device) {
                        device = {
                            'deviceId': obj.deviceId,
                            'deviceName': obj.deviceName,
                            'restarts': 0,
                            'watchdogResets': 0
                        }
                        _devices[obj.deviceId] = device
                    }
                    storageObj = {
                        'sensorName': obj.sensorName,
                        'sensorLabel': obj.sensorLabel,
                        'sensorId': obj.sensorId,
                        'device': device
                    }
                    _sensors[obj.sensorId] = storageObj
                }

                // update sensor with value and last sensor dt
                storageObj.sensorValue = obj.sensorValue
                storageObj.sensorDt = new Date()
            }
            
        })

        // callback
        callback()
        
    }).catch(err => {
        logSvc.error('Storage service is unable to make database query', err)
        callback(err)
    })
}
StorageService.prototype.getSensors = function() {
    let result = Object.assign({}, _sensors)
    return Object.freeze(result)
}
StorageService.prototype.getSensorsIds = function() {
    return Object.keys(_sensors)
}
StorageService.prototype.getSensorById = function(sensorId) {
    let s = _sensors[sensorId]
    return Object.assign({}, s)
}
StorageService.prototype.getDevices = function() {
    let result = Object.assign({}, _devices)
    return Object.freeze(result)
}
StorageService.prototype.getDeviceIds = function() {
    return Object.keys(_devices)
}
StorageService.prototype.getDeviceById = function(deviceId) {
    let d = _devices[deviceId]
    return Object.assign({}, d)
}
StorageService.prototype.terminate = function() {
    Object.keys(_devices).forEach(deviceId => {
        delete _devices[deviceId]
    })
    Object.keys(_sensors).forEach(sensorId => {
        delete _sensors[sensorId]
    })
}
module.exports = StorageService
