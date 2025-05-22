const sinon = require('sinon')
const {expect} = require('chai')
const DatabaseService = require('../src/services/database-service.js')

describe('database-services functionality', function() {
    let _buildPool = DatabaseService.prototype._buildPool
    beforeEach(function() {
        DatabaseService.prototype._buildPool = _buildPool
    })
    describe('test instance creation', function() {
        it('should set name correctly', function() {
            expect(new DatabaseService().name).to.be.equal('db')
        })
        it('should call _buildPool on creation', function() {
            DatabaseService.prototype._buildPool = sinon.fake.returns({})
            
            let db = new DatabaseService()
            db.init(sinon.fake())

            expect(DatabaseService.prototype._buildPool.calledOnce).to.be.true
            expect(db._pool).to.not.be.null
        })
    })
    describe('test instance termination', function() {
        it('should call end() on pool on termination', function() {
            let end = sinon.fake()
            DatabaseService.prototype._buildPool = sinon.fake.returns({
                'end': end
            })
            
            let db = new DatabaseService()
            db.init(sinon.fake())
            db.terminate()

            expect(end.calledOnce).to.be.true
        })
    })
    describe('test query', function() {
        it('should call query() on pool without args if no args', function() {
            let query = sinon.fake()
            DatabaseService.prototype._buildPool = sinon.fake.returns({
                'query': query
            })
            
            let db = new DatabaseService()
            db.init(sinon.fake())
            db.query('select * from foo')

            expect(query.firstCall.args[0]).to.be.equal('select * from foo')
        })
        it('should call query() on pool wit args if args', function() {
            let query = sinon.fake()
            DatabaseService.prototype._buildPool = sinon.fake.returns({
                'query': query
            })
            
            let db = new DatabaseService()
            db.init(sinon.fake())
            db.query('select * from foo', 'foo', 'bar', 'baz')

            expect(query.firstCall.args[0]).to.be.equal('select * from foo')
            expect(query.firstCall.args[1]).to.deep.equal(['foo','bar','baz'])
        })
    })
})