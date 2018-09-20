const util = require('util')
const PubNub = require('pubnub')
const {BaseService} = require('../configure-services.js')

const EventService = function() {
    this.name = 'event'
    this.dependencies = []
    this._instances = []
}
util.inherits(EventService, BaseService)
EventService.prototype.terminate = function() {
    this._instances.forEach(instance => {
        instance.unsubscribeAll()
    })
}
EventService.prototype._buildInstance = function(cfg) {
    return new PubNub(cfg)
}
EventService.prototype.getInstance = function(publish = false) {
    let cfg = {
        'ssl': true,
        'subscribeKey': process.env.PUBNUB_SUBSCRIBE_KEY
    }
    if (publish) cfg.publishKey = process.env.PUBNUB_PUBLISH_KEY
    let p = this._buildInstance(cfg)
    this._instances.push(p)
    return p
}
module.exports = EventService
