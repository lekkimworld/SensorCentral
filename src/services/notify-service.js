const util = require('util')
const moment = require('moment-timezone')
const constants = require('../constants.js')
const {lookupService, BaseService} = require('../configure-services.js')

const NotifyService = function() {
    this.name = 'notify'
    this.dependencies = ['log','event','pushover','storage']
}
util.inherits(NotifyService, BaseService)
NotifyService.prototype.init = function(callback, logSvc, eventSvc, pushoverSvc, storageSvc) {
    let pushoverLastSent = undefined

    eventSvc.subscribe([constants.PUBNUB.CTRL_CHANNEL, constants.PUBNUB.RAW_SENSORREADING_CHANNEL], (channel, obj) => {
        logSvc.debug(`Notify service received message on channel ${channel} with payload=${JSON.stringify(obj)}`)
        if (channel === constants.PUBNUB.CTRL_CHANNEL) {
            storageSvc.getDeviceById(obj.deviceId).then(device => {
                if (obj.hasOwnProperty('restart') && true === obj.restart) {
                    // this is restart event - notify
                    if (device) {
                        pushoverSvc.notify('Device restart', `Device restart (<${device.deviceId}> / <${device.deviceName}>) - maybe it didn't pat the watchdog?`)
                    } else {
                        pushoverSvc.notify('UNKNOWN Device restart', `UNKNOWN Device restart (<${obj.deviceId}>) - maybe it didn't pat the watchdog?`)
                    }
                    
                } else if (obj.hasOwnProperty('watchdogReset') && obj.watchdogReset === true) {
                    // this is watchdogReset event - notify
                    if (device) {
                        pushoverSvc.notify(`Device watchdog`, `Watchdog for device (<${device.deviceId}> / <${device.deviceName}>) reset meaning we received no communication from it in ${constants.DEFAULTS.WATCHDOG.DEFAULT_TIMEOUT} ms (${constants.DEFAULTS.WATCHDOG.DEFAULT_TIMEOUT / 60000} minutes)`)
                    } else {
                        pushoverSvc.notify(`UNKNOWN Device watchdog`, `UNKNOWN Watchdog for device (<${obj.deviceId}>) reset meaning we received no communication from it in ${constants.DEFAULTS.WATCHDOG.DEFAULT_TIMEOUT} ms (${constants.DEFAULTS.WATCHDOG.DEFAULT_TIMEOUT / 60000} minutes)`)
                    }
                }
            }).catch(err => {
                console.log(err);
            })
            
            
        } else if (channel === constants.PUBNUB.RAW_SENSORREADING_CHANNEL) {
            if (obj.sensorId === '28FF46C76017059A' && obj.sensorValue < 0 && (!pushoverLastSent || moment().diff(pushoverLastSent, 'minutes') > 60)) {
                pushoverLastSent = moment()
                pushoverSvc.notify('Frostvejr', `Det er frostvejr... (${obj.sensorValue})`)
            }
        }
    })

    callback()
}
module.exports = NotifyService
