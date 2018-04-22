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
