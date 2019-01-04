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
                name: 'foo1'
            }).then(svc => {
                // assert the name
                expect(svc.name).to.be.equal('foo1')
                done()
            })
        })
        it('should fail if service with name already registered', function(done) {
            registerService({name: 'foo2'}).then(svc => {
                registerService({name: 'foo2'}).then(svc => {
                    done(Error('Should fail'))
                }).catch(err => {
                    done()
                })
            })
        })
        it('should return service after init-method has been run', function(done) {
            registerService({
                name: 'foo3',
                init: sinon.fake.yields()
            }).then(svc => {
                expect(svc.name).to.be.equal('foo3')
                expect(svc.init.calledOnce).to.be.true
                done()
            })
        })
        it('should never call init if there is a service with same name', function(done) {
            let secondService = {
                name: 'foo4',
                init: sinon.fake.yields()
            }
            registerService({
                name: 'foo4'
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
            registerService({name: 'foo5'}).then(svc => {
                return registerService({
                    name: 'bar',
                    dependencies: ['foo5']
                })
            }).then(svc => {
                expect(svc.name).to.be.equal('bar')
                done()
            })
        })

        it('should simply return a promise with the dependant service even if dependent is registered first', (done) => {
            let fooService = {
                name: 'foo6',
                init: sinon.fake.yields()
            }
            registerService({name: 'bar', dependencies: ['foo6']}).then(svc => {
                expect(svc.name).to.be.equal('bar')
                expect(fooService.init.calledOnce).to.be.true
                done()
            })

            // register service we depend on
            registerService(fooService).then(svc => {
                expect(svc.name).to.be.equal('foo6')
            })
        })

        it('should return the same service if looked up multiple times', function(done) {
            let service = {
                name: 'foo7'
            }
            registerService(service).then(svc => {
                expect(svc.name).to.be.equal('foo7')

                lookupService('foo7').then(svc => {
                    expect(svc.name).to.be.equal('foo7')
                    done()
                })
            })
        })

        it('should reject the promise if init throws exception', function(done) {
            let service = {
                name: 'fail_init_service',
                init: sinon.fake.throws(new Error())
            }
            registerService(service).then(() => {
                done(Error('Should fail'))
            }).catch(err => {
                done()
            })
        })

        it('should reject if lookupService takes too long', function(done) {
            let handle
            let service = {
                name: 'too_long',
                init: (cb) => {
                    // make a looooong init method
                    handle = global.setTimeout(cb, 20000)
                }
            }
            registerService(service).catch(() => {
                // ignore
            })
            lookupService('too_long').then(() => {
                // should not happen
                console.log('1')
                done(Error('Should fail'))
            }).catch(err => {
                global.clearTimeout(handle)
                expect(err.message).to.be.equal('Time out looking up service <too_long>')
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
                done(err)
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
                done(err)
            })
        })

        it('expect lookup service to fail if service unknown', function(done) {
            let service = {
                name: 'unknown'
            }
            registerService(service).catch(() => {
                // ignore
            })
            lookupService('unknown_lookup').then(result => {
                done(Error('Should fail'))
            }).catch(err => {
                done()
            })
        })

        it('should retry service init if callback with error', function(done) {
            let didfail = false
            let svcRequirement = {
                name: 'requirement'
            }
            let svcDependant = {
                name: 'dependant',
                dependencies: ['requirement'],
                init: (callback) => {
                    if (!didfail) {
                        didfail = true
                        return callback(Error('Fail on first invocation'))
                    }
                    return callback()
                }
            }

            registerService(svcRequirement)
            registerService(svcDependant)

            lookupService('dependant', 20000).then(result => {
                done()
            }).catch(err => {
                done(err)
            })
        }).timeout(20000)
    })
    
})