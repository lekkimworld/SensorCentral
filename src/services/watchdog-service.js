const util = require('util')
const {BaseService} = require('../configure-services.js')
const {Watchdog} = require('watchdog')
const constants = require('../constants.js')

const _watchdogs = {}

const WatchdogService = function() {
    this.name = 'watchdog'
    this.dependencies = ['log','event','storage']
}
util.inherits(WatchdogService, BaseService)
WatchdogService.prototype.init = function(callback, logSvc, eventSvc, storageSvc) {
    // get the storage and get set of device ID's
    const storage = storageSvc.getInstance()
    Object.keys(storage).reduce((zet, sensorId) => {
        zet.add(storage[sensorId].deviceId)
        return zet
    }, new Set()).forEach(deviceId => {
        logSvc.info(`Adding watchdog for device wiith ID <${deviceId}> with timeout <${constants.DEFAULTS.WATCHDOG.DEFAULT_TIMEOUT}>`)
        let w = new Watchdog(constants.DEFAULTS.WATCHDOG.DEFAULT_TIMEOUT, deviceId)
        w.on('reset', () => {
            logSvc.info(`Device (${deviceId}) reset (${new Date(w.lastFeed).toISOString()})`)
            w.feed()
        })
        w.feed()
        _watchdogs[deviceId] = w
    })

    // listen to event service to feed watchdog on events
    eventSvc.subscribe(constants.PUBNUB.RAW_DEVICEREADING_CHANNEL, (channel, msg) => {
        // get device id
        const deviceId = msg.deviceId
        if (_watchdogs[deviceId]) _watchdogs[deviceId].feed()
    })
    
    // callback to signal init done
    callback()
}
module.exports = WatchdogService
