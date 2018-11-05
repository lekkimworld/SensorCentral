const util = require('util')
const Pushover = require('node-pushover')
const {lookupService, BaseService} = require('../configure-services.js')

// get pushover data from env
const PUSHOVER_APPTOKEN = process.env.PUSHOVER_APPTOKEN
const PUSHOVER_USERKEY = process.env.PUSHOVER_USERKEY
const pushover = (function() {
    if (PUSHOVER_USERKEY && PUSHOVER_APPTOKEN) {
        return new Pushover({
            token: PUSHOVER_APPTOKEN,
            user: PUSHOVER_USERKEY
        })
    }
})()
if (!pushover) {
    // nothing to do here
    console.log('Pushover support not configured...')
}

const NotifyService = function() {
    this.name = 'notify'
    this.dependencies = ['log']
}
util.inherits(NotifyService, BaseService)
NotifyService.prototype.init = function(callback, logSvc) {
    this._log = logSvc
    callback()
}
NotifyService.prototype.notify = function(payload) {
    if (!pushover) return
    
    logSvc.info(`Asked to notify with payload ${typeof payload === 'object' ? JSON.stringify(payload) : payload}`)
    pushover.send(payload)
}
module.exports = NotifyService
