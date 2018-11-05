const util = require('util')
const {lookupService, BaseService} = require('../configure-services.js')

const LEVELS = Object.freeze({
    'DEBUG': 0,
    'INFO': 1,
    'WARN': 2,
    'ERROR': 3
})
const logit = (level, msg) => {
    let strlevel = Object.keys(LEVELS)[level]
    console.log(`${strlevel} - ${msg}`)
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
module.exports = LogService
