const util = require('util')
const {BaseService} = require('../configure-services.js')
const {Watchdog} = require('watchdog')

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
        let w = new Watchdog(5000, deviceId)
        w.on('reset', () => {
            logSvc.info(`Device (${deviceId}) reset (${new Date(w.lastFeed).toISOString()})`)
            w.feed()
        })
        w.feed()
        _watchdogs[deviceId] = w
    })
    
    callback()
}
module.exports = WatchdogService
