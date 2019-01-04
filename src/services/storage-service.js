const util = require('util')
const constants = require('../constants.js')
const {BaseService} = require('../configure-services.js')

const StorageService = function() {
    this._storage = {}
    this.name = 'storage'
    this.dependencies = ['db', 'log', 'event']
}
util.inherits(StorageService, BaseService)
StorageService.prototype.init = function(callback, dbSvc, logSvc, eventSvc) {
    // get the sensors we care about from the db
    dbSvc.query("select s.id sensorId, s.name sensorName, s.label sensorLabel, s.type sensorType, d.id deviceId, d.name deviceName from sensor s, device d where s.deviceId=d.id").then(rs => {
        rs.rows.forEach(row => {
            this._storage[row.sensorid] = {
                'sensorId': row.sensorid,
                'sensorName': row.sensorname, 
                'sensorLabel': row.sensorlabel,
                'sensorType': row.sensortype,
                'sensorValue': Number.MIN_VALUE, 
                'sensorDt': undefined, 
                'deviceId': row.deviceid,
                'deviceName': row.devicename
            }
        })
        
        // listen for events and keep last event data around for each sensor
        eventSvc.subscribe(constants.PUBNUB.AUG_CHANNEL, (channel, obj) => {
            logSvc.info(`Storage service received message on ${channel} channel with payload ${JSON.stringify(obj)}`)

            // put in storage
            let storageObj = this._storage[obj.sensorId]
            if (!storageObj) {
                // we do now know a sensor with this id (i.e. it's not in the db) - create it
                storageObj = {}
                storageObj.sensorName = obj.sensorName
                storageObj.sensorLabel = obj.sensorLabel
                storageObj.sensorId = obj.sensorId
                storageObj.deviceId = obj.deviceId
                storageObj.deviceName = obj.deviceName
                this._storage[obj.sensorId] = storageObj
            }
            storageObj.sensorValue = obj.sensorValue
            storageObj.sensorDt = new Date()
        })

        // callback
        callback()
    })
}
StorageService.prototype.getInstance = function() {
    let result = Object.assign({}, this._storage)
    return Object.freeze(result)
}
module.exports = StorageService
