const util = require('util')
const constants = require('../constants.js')
const {lookupService, BaseService} = require('../configure-services.js')

const StorageService = function() {
    this._storage = {}
    this.name = 'storage'
    this.dependencies = ['db', 'event']
}
util.inherits(StorageService, BaseService)
StorageService.prototype.init = function(callback) {
    // get the db service
    lookupService('db').then(svc => {
        // get the sensors we care about from the db
        return svc.query("select s.id sensorId, s.name sensorName, s.label sensorLabel, s.type sensorType, d.id deviceId, d.name deviceName from sensor s, device d where s.deviceId=d.id")
    }).then(rs => {
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
    }).then(() => {
        // get events service 
        return lookupService('event')
    }).then(svc => {
        // listen for events and keep last event data around for each sensor
        const pubnub = svc.getInstance(true)
        pubnub.addListener({
            'message': (msg) => {
                const channelName = msg.channel
                const obj = msg.message
                console.log(`Received message on ${channelName} channel with payload ${JSON.stringify(obj)}`)

                // put in storage
                this._storage[obj.sensorId].sensorValue = obj.sensorValue
                this._storage[obj.sensorId].sensorDt = new Date()
            }
        })
        pubnub.subscribe({
            channels: [constants.PUBNUB.AUG_CHANNEL_NAME]
        })

        // callback
        callback()
    })
}
StorageService.prototype.getInstance = function() {
    return Object.freeze(this._storage)
}
module.exports = StorageService
