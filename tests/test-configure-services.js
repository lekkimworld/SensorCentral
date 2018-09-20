const {expect} = require('chai')
const sinon = require('sinon')
const {registerService, lookupService, reset} = require('../src/configure-services.js')

describe('configure-services functionality', function() {
    // ensure we reset the services model
    afterEach(function() {
        reset()
    })

    describe('test registering non-dependant service', function() {
        it('should simple return a promise that resolves with the service', function(done) {
            // register a very simple service
            registerService({
                name: 'foo'
            }).then(svc => {
                // assert the name
                expect(svc.name).to.be.equal('foo')
                done()
            })
        })
        it('should fail if service with name already registered', function(done) {
            registerService({name: 'foo'}).then(svc => {
                registerService({name: 'foo'}).then(svc => {
                    
                }).catch(err => {
                    done()
                })
            })
        })
        it('should return service after init-method has been run', function(done) {
            registerService({
                name: 'foo',
                init: sinon.fake.yields()
            }).then(svc => {
                expect(svc.name).to.be.equal('foo')
                expect(svc.init.calledOnce).to.be.true
                done()
            })
        })
        it('should never call init if there is a service with same name', function(done) {
            let secondService = {
                name: 'foo',
                init: sinon.fake.yields()
            }
            registerService({
                name: 'foo'
            }).then(svc => {
                registerService(secondService).catch(err => {
                    expect(secondService.init.notCalled).to.be.true
                    done()
                })
            })
        })
    })
    
    describe('test adding dependant service', () => {
        it('should simply return a promise with the dependant service', (done) => {
            registerService({name: 'foo'}).then(svc => {
                return registerService({
                    name: 'bar',
                    dependencies: ['foo']
                })
            }).then(svc => {
                expect(svc.name).to.be.equal('bar')
                done()
            })
        })

        it('should simply return a promise with the dependant service even if dependent is registered first', (done) => {
            let fooService = {
                name: 'foo',
                init: sinon.fake.yields()
            }
            registerService({name: 'bar', dependencies: ['foo']}).then(svc => {
                expect(svc.name).to.be.equal('bar')
                expect(fooService.init.calledOnce).to.be.true
                done()
            })

            // register service we depend on
            registerService(fooService).then(svc => {
                expect(svc.name).to.be.equal('foo')
            })
        })

        it('should return the same service if looked up multiple times', function(done) {
            let service = {
                name: 'foo'
            }
            registerService(service).then(svc => {
                expect(svc.name).to.be.equal('foo')

                lookupService('foo').then(svc => {
                    expect(svc.name).to.be.equal('foo')
                    done()
                })
            })
        })

        it('should reject the promise if init fails', function(done) {
            let service = {
                name: 'foo',
                init: sinon.fake.throws(new Error())
            }
            registerService(service).then(() => {
                expect.fail()
            }).catch(err => {
                done()
            })
        })
    })
    
})