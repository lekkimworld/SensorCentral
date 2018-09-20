const {Pool} = require('pg')
const util = require('util')
const {BaseService} = require('../configure-services.js')

const DatabaseService = function() {
    this.name = 'db'
}
util.inherits(DatabaseService, BaseService)
DatabaseService.prototype.init = function(callback) {
    this._pool = this._buildPool()
    callback()
}
DatabaseService.prototype._buildPool = function() {
    return new Pool({
        'connectionString': process.env.DATABASE_URL,
        'ssl': true
    })
}
DatabaseService.prototype.terminate = function() {
    this._pool.end()
    this._pool = undefined
}
DatabaseService.prototype.query = function(query, ...args) {
    return this._pool.query(query, args)
}
module.exports = DatabaseService
