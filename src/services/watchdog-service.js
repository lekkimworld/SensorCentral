const util = require('util')
const {BaseService} = require('../configure-services.js')
const {Watchdog} = require('watchdog')
const constants = require('../constants.js')

const _watchdogs = {}

const WatchdogService = function() {
    this.name = 'watchdog'
    this.dependencies = ['log','event','storage', 'pushover']
}
util.inherits(WatchdogService, BaseService)
WatchdogService.prototype.init = function(callback, logSvc, eventSvc, storageSvc, notifySvc) {
    // get the storage and get set of device ID's
    storageSvc.getDeviceIds().forEach(deviceId => {
        // get device
        let device = storageSvc.getDeviceById(deviceId)

        // create a watchdog per device
        logSvc.info(`Adding watchdog for device with ID <${device.deviceId}> and name <${device.deviceName}> with timeout <${constants.DEFAULTS.WATCHDOG.DEFAULT_TIMEOUT}>`)
        let w = new Watchdog(constants.DEFAULTS.WATCHDOG.DEFAULT_TIMEOUT, device.deviceId)

        // listen for resets
        w.on('reset', () => {
            // log
            logSvc.info(`Device (<${device.deviceId}> / <${device.deviceName}>) reset (${new Date(w.lastFeed).toISOString()})`)
            
            // feed watchdog
            w.feed()

            // publish event
            eventSvc.getInstance(true).publish({
                channel: constants.PUBNUB.CTRL_CHANNEL,
                message: {
                    'deviceId': deviceId,
                    'watchdogReset': true
                }
            })
        })
        w.feed()
        _watchdogs[deviceId] = w
    })

    // listen to event service to feed watchdog on events
    eventSvc.subscribe(constants.PUBNUB.RAW_DEVICEREADING_CHANNEL, (channel, msg) => {
        // get device id
        const deviceId = msg.deviceId

        // feed watchdog
        if (_watchdogs[deviceId]) _watchdogs[deviceId].feed()
    })
    
    // callback to signal init done
    callback()
}
module.exports = WatchdogService
