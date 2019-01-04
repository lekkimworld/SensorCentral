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

        it('should reject if lookupService takes too long', function(done) {
            let service = {
                name: 'foo',
                init: (cb) => {
                    // make a looooon init method
                    setTimeout(cb, 1000)
                }
            }
            registerService(service).catch(() => {
                // ignore
            })
            lookupService('foo').then(() => {
                // should not happen
                expect.fail()
            }).catch(err => {
                expect(err.message).to.be.equal('Time out looking up service <foo>')
                done()
            })
        })

        it('should be able to lookup service by name', function(done) {
            let service = {
                name: 'foo'
            }
            registerService(service).catch(() => {
                // ignore
            })
            lookupService('foo').then(result => {
                expect(result.name).to.be.equal('foo')
                done()
            }).catch(err => {
                expect.fail()
            })
        })

        it('should be able to lookup multiple services by array of names', function(done) {
            let service1 = {
                name: 'foo'
            }
            let service2 = {
                name: 'bar'
            }
            registerService(service1)
            registerService(service2)
            lookupService(['foo','bar']).then(result => {
                expect(result[0].name).to.be.equal('foo')
                expect(result[1].name).to.be.equal('bar')
                done()
            }).catch(err => {
                console.log(err)
                expect.fail()
            })
        })

        it('expect lookup service to fail if service unknown', function(done) {
            let service = {
                name: 'foo'
            }
            registerService(service).catch(() => {
                // ignore
            })
            lookupService('bar').then(result => {
                expect.fail()
            }).catch(err => {
                done()
            })
        })
    })
    
})