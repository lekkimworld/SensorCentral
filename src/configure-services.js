const {Pool} = require('pg')
const PubNub = require('pubnub')
const util = require('util')
const constants = require('./constants.js')
const terminateListener = require('./terminate-listener.js')

const BaseService = function() {}
BaseService.prototype.terminate = function() {}

const Services = function() {
    this.db = new DatabaseService()
    this.events = new EventService()
}
Services.prototype.terminate = function() {
    this.db.terminate()
    this.events.terminate()
}
const DatabaseService = function() {
    this._pool = new Pool({
        'connectionString': process.env.DATABASE_URL,
        'ssl': true
    })
}
util.inherits(DatabaseService, BaseService)
DatabaseService.prototype.terminate = function() {
    this._pool.end()
    this._pool = undefined
}
DatabaseService.prototype.query = function(query, ...args) {
    return this._pool.query(query, args)
}
DatabaseService.prototype.queryAllLatestSensorValues = function(query, ...args) {
    if (constants.IS.TEST) {
        let rows = [
            {'sensorid': '1', 'sensortype': 'temp', 'sensorname': 'temp sensor1', 'sensorvalue': 1.1, 'deviceid': 't1', 'devicename': 'temp device 1', 'dt': new Date()},
            {'sensorid': '2', 'sensortype': 'temp', 'sensorname': 'temp sensor2', 'sensorvalue': 2.1, 'deviceid': 't2', 'devicename': 'temp device 2', 'dt': new Date()},
            {'sensorid': '3', 'sensortype': 'hum', 'sensorname': 'hum sensor2', 'sensorvalue': 2.1, 'deviceid': 'h1', 'devicename': 'hum device 1', 'dt': new Date()},
            {'sensorid': '4', 'sensortype': null, 'sensorname': null, 'sensorvalue': 3.1, 'deviceid': null, 'devicename': null, 'dt': new Date()}
        ]
        return Promise.resolve({"rows": rows})
    }
    return this.query("select d.dt dt, de.id deviceId, d.id sensorId, s.name sensorName, s.type sensorType, de.name deviceName, round(cast(d.value as numeric), 1) sensorValue from (select id, dt, value from (select row_number() over (partition by id order by dt desc) as r, t.* from sensor_data t) x where x.r < 2) d left outer join sensor s on d.id=s.id left outer join device de on de.id=s.deviceId order by de.name, s.name;")
}

const EventService = function() {
    this._instances = []
}
util.inherits(EventService, BaseService)
EventService.prototype.terminate = function() {
    this._instances.forEach(instance => {
        instance.unsubscribeAll()
    })
}
EventService.prototype.getInstance = function(publish = false) {
    let cfg = {
        'ssl': true,
        'subscribeKey': process.env.PUBNUB_SUBSCRIBE_KEY
    }
    if (publish) cfg.publishKey = process.env.PUBNUB_PUBLISH_KEY
    let p = new PubNub(cfg)
    this._instances.push(p)
    return p
}

// create instance
const srvc = new Services()

// export
module.exports = srvc
