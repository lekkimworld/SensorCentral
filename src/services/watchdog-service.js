const util = require('util')
const {BaseService} = require('../configure-services.js')
const {Watchdog} = require('watchdog')
const constants = require('../constants.js')

const _watchdogs = {}

const WatchdogService = function() {
    this.name = 'watchdog'
    this.dependencies = ['log','event','storage', 'notify']
}
util.inherits(WatchdogService, BaseService)
WatchdogService.prototype.init = function(callback, logSvc, eventSvc, storageSvc, notifySvc) {
    // get the storage and get set of device ID's
    const storage = storageSvc.getInstance()
    Object.keys(storage).reduce((zet, sensorId) => {
        zet.add(storage[sensorId].deviceId.toUpperCase())
        return zet
    }, new Set()).forEach(deviceId => {
        // create a watchdog per device
        const deviceName = Object.keys(storage).reduce((prev, sensorId) => {
            if (prev) return prev
            if (storage[sensorId].deviceId.toUpperCase() === deviceId) return storage[sensorId].deviceName
        })
        logSvc.info(`Adding watchdog for device with ID <${deviceId}> and name <${deviceName}> with timeout <${constants.DEFAULTS.WATCHDOG.DEFAULT_TIMEOUT}>`)
        let w = new Watchdog(constants.DEFAULTS.WATCHDOG.DEFAULT_TIMEOUT, deviceId)
        w.on('reset', () => {
            logSvc.info(`Device (<${deviceId}> / <${deviceName}>) reset (${new Date(w.lastFeed).toISOString()})`)
            notifySvc.notify(`Watchdog for device (<${deviceId}> / <${deviceName}>) reset meaning we received no communication from it in ${constants.DEFAULTS.WATCHDOG.DEFAULT_TIMEOUT} ms (${constants.DEFAULTS.WATCHDOG.DEFAULT_TIMEOUT / 60000} minutes)`)
            w.feed()
        })
        w.feed()
        _watchdogs[deviceId] = w
    })

    // listen to event service to feed watchdog on events
    eventSvc.subscribe(constants.PUBNUB.RAW_DEVICEREADING_CHANNEL, (channel, msg) => {
        // get device id
        const deviceId = msg.deviceId.toUpperCase()
        if (_watchdogs[deviceId]) _watchdogs[deviceId].feed()
    })
    
    // callback to signal init done
    callback()
}
module.exports = WatchdogService
