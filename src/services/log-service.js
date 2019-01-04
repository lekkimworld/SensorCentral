const util = require('util')
const {lookupService, BaseService} = require('../configure-services.js')

const LEVELS = Object.freeze({
    'DEBUG': 0,
    'INFO': 1,
    'WARN': 2,
    'ERROR': 3
})
const logit = (level, msg, err) => {
    let strlevel = Object.keys(LEVELS)[level]
    if (err) {
        console.log(`${strlevel} - ${msg} (${err.message})`, err)
    } else {
        console.log(`${strlevel} - ${msg}`)
    }
}

const LogService = function() {
    this.name = 'log'
    this.dependencies = []
}
util.inherits(LogService, BaseService)
LogService.prototype.debug = function(msg) {
    logit(LEVELS.DEBUG, msg)
}
LogService.prototype.info = function(msg) {
    logit(LEVELS.INFO, msg)
}
LogService.prototype.warn = function(msg, err) {
    if (err) {
        logit(LEVELS.WARN, msg, err)
    } else {
        logit(LEVELS.WARN, msg)
    }
}
LogService.prototype.error = function(msg, err) {
    if (err) {
        logit(LEVELS.ERROR, msg, err)
    } else {
        logit(LEVELS.ERROR, msg)
    }
}
module.exports = LogService
