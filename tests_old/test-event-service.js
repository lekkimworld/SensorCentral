const sinon = require('sinon')
const {expect} = require('chai')
const EventService = require('../src/services/event-service.js')

describe('event-service functionality', function() {
    let _buildInstance = EventService.prototype._buildInstance
    beforeEach(function() {
        EventService.prototype._buildInstance = _buildInstance
    })

    describe('simple tests', function() {
        it('should set name', function() {
            expect(new EventService().name).to.be.equal('event')
        })
    })
    describe('build and termination', function() {
        it('should call _buildInstance on getInstance', function() {
            let ev = new EventService()
            ev._buildInstance = sinon.fake.returns({'foo': 'bar'})
            expect(ev._instances).to.be.empty

            let inst = ev.getInstance()
            expect(ev._instances).not.to.be.empty
            expect(ev._instances.length).to.be.equal(1)
            expect(ev._instances[0].foo).to.be.equal('bar')
            expect(ev._buildInstance.firstCall.args[0]).to.have.keys(['ssl','subscribeKey'])
        })
        it('should call _buildInstance on getInstance with true', function() {
            process.env.PUBNUB_PUBLISH_KEY = 'foobar'

            let ev = new EventService()
            ev._buildInstance = sinon.fake.returns({'foo': 'bar'})
            expect(ev._instances).to.be.empty

            let inst = ev.getInstance(true)
            expect(ev._instances).not.to.be.empty
            expect(ev._instances.length).to.be.equal(1)
            expect(ev._buildInstance.firstCall.args[0]).to.have.keys(['ssl','subscribeKey','publishKey'])
            expect(ev._buildInstance.firstCall.args[0].publishKey).to.be.equal('foobar')
        })
        it('should call subsubscribe on all instances on terminate', function() {
            let f = sinon.fake()
            let ev = new EventService()
            ev._buildInstance = sinon.fake.returns({'unsubscribeAll': f})
            ev.getInstance(true)
            ev.getInstance(true)
            ev.terminate()
            expect(f.callCount).to.be.equal(2)
        })
    })

})
