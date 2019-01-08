const sinon = require('sinon')
const {expect} = require('chai')
const StorageService = require('../src/services/storage-service.js')
const {registerService, terminate} = require('../src/configure-services.js')
const constants = require('../src/constants.js')

describe('storage-service tests', function() {
    this.afterEach(function() {
        terminate()
    })

    describe('simple tests', function() {
        it('should set correct name', function() {
            expect(new StorageService().name).to.be.equal('storage')
        })
        it('should have correct dependencies', function() {
            expect(new StorageService().dependencies).to.be.deep.equal(['db', 'log', 'event'])
        })
    })

    describe('initialization tests', function() {
        it('should wait for dependencies', function(done) {
            let dbsvc = {
                name: 'db',
                init: sinon.fake.yields(),
                query: sinon.fake.resolves({
                    rows: [
                        {
                            sensorid: 'id1',
                            sensorname: 'name1',
                            sensorlabel: 'label1',
                            sensortype: 'temp',
                            deviceid: 'deviceid1',
                            devicename: 'devicename1',
                        }
                    ]
                })
            }
            let eventsvc = {
                name: 'event',
                init: sinon.fake.yields(),
                getInstance: sinon.fake.returns({
                    addListener: sinon.fake(),
                    subscribe: sinon.fake()
                }),
                subscribe: sinon.fake()
            }
            let logsvc = {
                name: 'log',
                init: sinon.fake.yields()
            }
            registerService(dbsvc)
            registerService(logsvc)
            registerService(eventsvc)
            
            let ss = new StorageService()
            registerService(ss).then(svc => {
                expect(dbsvc.query.callCount).to.be.equal(1)
                expect(dbsvc.query.firstCall.args[0]).to.be.equal('select s.id sensorId, s.name sensorName, s.label sensorLabel, s.type sensorType, d.id deviceId, d.name deviceName from sensor s, device d where s.deviceId=d.id')
                expect(Object.keys(ss.getSensors()).length).to.be.equal(1)
                
                // lookup with ID
                expect(ss.getSensors()).to.have.keys(['id1'])
                let o = ss.getSensorById('id1')
                expect(o).to.have.keys(['sensorId', 'sensorName', 'sensorLabel', 'sensorType','sensorValue','sensorDt','device'])
                expect(o.sensorId).to.be.equal('id1')
                expect(o.sensorLabel).to.be.equal('label1')
                expect(o.sensorName).to.be.equal('name1')
                expect(o.device.deviceId).to.be.equal('deviceid1')
                expect(o.device.deviceName).to.be.equal('devicename1')

                expect(ss.getDevices()).to.have.keys(['deviceid1'])
                let d = ss.getDeviceById('deviceid1')
                expect(d.deviceId).to.be.equal('deviceid1')
                expect(d.deviceName).to.be.equal('devicename1')

                done()

            })
            
            
        })
    })

    describe('augmented sensor event tests', function() {
        it('should update sensor dt and value on event', function(done) {
            let dbsvc = {
                name: 'db',
                query: sinon.fake.resolves({
                    rows: [
                        {
                            sensorid: 'id1',
                            sensorname: 'name1',
                            sensorlabel: 'label1',
                            sensortype: 'temp',
                            deviceid: 'deviceid1',
                            devicename: 'devicename1',
                        }
                    ]
                })
            }
            let logsvc = {
                name: 'log',
                'debug': sinon.fake(),
                'info': sinon.fake(),
                'warn': sinon.fake(),
                'error': sinon.fake()
            }
            let ss = new StorageService()
            let callback
            registerService(dbsvc)
            registerService(logsvc)
            const eventsvc = {
                'name': 'event',
                'subscribe': (channel, cb) => {
                    expect(channel).to.deep.equal([constants.PUBNUB.AUG_CHANNEL, constants.PUBNUB.CTRL_CHANNEL])
                    expect(typeof cb === 'function')
                    callback = cb
                },
                'publish': (obj) => {
                    callback(constants.PUBNUB.AUG_CHANNEL, obj)
                    let s = ss.getSensorById('id1')
                    expect(s.sensorValue).to.be.equal(123)
                    expect(typeof s.sensorDt).to.be.equal('object')
                    expect(s.sensorDt.getTime()).to.be.most(Date.now())
                    done()
                }
            }
            registerService(eventsvc)

            registerService(ss).then(svcs => {
                eventsvc.publish({
                    'sensorId': 'id1',
                    'sensorValue': 123
                })
            })
        })
    })

    describe('control messages tests', function() {
        it('should update restart count on control nessage with restart=true (known device)', function(done) {
            let dbsvc = {
                name: 'db',
                query: sinon.fake.resolves({
                    rows: [
                        {
                            sensorid: 'id1',
                            sensorname: 'name1',
                            sensorlabel: 'label1',
                            sensortype: 'temp',
                            deviceid: 'deviceid1',
                            devicename: 'devicename1',
                        }
                    ]
                })
            }
            let logsvc = {
                name: 'log',
                'debug': sinon.fake(),
                'info': sinon.fake(),
                'warn': sinon.fake(),
                'error': sinon.fake()
            }
            let ss = new StorageService()
            let callback
            registerService(dbsvc)
            registerService(logsvc)
            const eventsvc = {
                'name': 'event',
                'subscribe': (channel, cb) => {
                    callback = cb
                },
                'publish': (obj) => {
                    callback(constants.PUBNUB.CTRL_CHANNEL, obj)
                    let d = ss.getDeviceById('deviceid1')
                    expect(d.restarts).to.be.equal(1)
                    expect(d.watchdogResets).to.be.equal(0)
                    done()
                }
            }
            registerService(eventsvc)

            registerService(ss).then(svcs => {
                eventsvc.publish({
                    'deviceId': 'deviceid1',
                    'restart': true
                })
            })
        })

        it('should update restart count on control nessage with restart=true (unknown device)', function(done) {
            let dbsvc = {
                name: 'db',
                query: sinon.fake.resolves({
                    rows: []
                })
            }
            let logsvc = {
                name: 'log',
                'debug': sinon.fake(),
                'info': sinon.fake(),
                'warn': sinon.fake(),
                'error': sinon.fake()
            }
            let ss = new StorageService()
            let callback
            registerService(dbsvc)
            registerService(logsvc)
            const eventsvc = {
                'name': 'event',
                'subscribe': (channel, cb) => {
                    callback = cb
                },
                'publish': (obj) => {
                    callback(constants.PUBNUB.CTRL_CHANNEL, obj)
                    let d = ss.getDeviceById('deviceid1')
                    expect(d.restarts).to.be.equal(1)
                    expect(d.watchdogResets).to.be.equal(0)
                    done()
                }
            }
            registerService(eventsvc)

            registerService(ss).then(svcs => {
                eventsvc.publish({
                    'deviceId': 'deviceid1',
                    'restart': true
                })
            })
        })

        it('should update watchdog reset count on control nessage with restart=true (known device)', function(done) {
            let dbsvc = {
                name: 'db',
                query: sinon.fake.resolves({
                    rows: [
                        {
                            sensorid: 'id1',
                            sensorname: 'name1',
                            sensorlabel: 'label1',
                            sensortype: 'temp',
                            deviceid: 'deviceid1',
                            devicename: 'devicename1',
                        }
                    ]
                })
            }
            let logsvc = {
                name: 'log',
                'debug': sinon.fake(),
                'info': sinon.fake(),
                'warn': sinon.fake(),
                'error': sinon.fake()
            }
            let ss = new StorageService()
            let callback
            registerService(dbsvc)
            registerService(logsvc)
            const eventsvc = {
                'name': 'event',
                'subscribe': (channel, cb) => {
                    callback = cb
                },
                'publish': (obj) => {
                    callback(constants.PUBNUB.CTRL_CHANNEL, obj)
                    let d = ss.getDeviceById('deviceid1')
                    expect(d.restarts).to.be.equal(0)
                    expect(d.watchdogResets).to.be.equal(1)
                    done()
                }
            }
            registerService(eventsvc)

            registerService(ss).then(svcs => {
                eventsvc.publish({
                    'deviceId': 'deviceid1',
                    'watchdogReset': true
                })
            })
        })

        it('should update watchdog reset count on control nessage with restart=true (unknown device)', function(done) {
            let dbsvc = {
                name: 'db',
                query: sinon.fake.resolves({
                    rows: []
                })
            }
            let logsvc = {
                name: 'log',
                'debug': sinon.fake(),
                'info': sinon.fake(),
                'warn': sinon.fake(),
                'error': sinon.fake()
            }
            let ss = new StorageService()
            let callback
            registerService(dbsvc)
            registerService(logsvc)
            const eventsvc = {
                'name': 'event',
                'subscribe': (channel, cb) => {
                    callback = cb
                },
                'publish': (obj) => {
                    callback(constants.PUBNUB.CTRL_CHANNEL, obj)
                    let d = ss.getDeviceById('deviceid1')
                    expect(d.restarts).to.be.equal(0)
                    expect(d.watchdogResets).to.be.equal(1)
                    done()
                }
            }
            registerService(eventsvc)

            registerService(ss).then(svcs => {
                eventsvc.publish({
                    'deviceId': 'deviceid1',
                    'watchdogReset': true
                })
            })
        })
    })
})

