const sinon = require('sinon')
const {expect} = require('chai')
const {registerService, terminate} = require('../src/configure-services.js')
const supertest = require('supertest')
const express = require('express')

describe('test-prometheus-scape-endpoint', function() {
    let request
    beforeEach(function() {
        terminate()

        const app = express()
        app.use(require('../src/routes/prometheus-scape-endpoint.js'))
        request = supertest(app)
    })

    describe('test sensors', function() {
        it('should send code 500 if no service', function(done) {
            request.get('/scrapedata')
                .expect('Content-Type', 'text/plain; charset=utf-8')
                .expect(500, (err, res) => {
                    if (err) {
                        console.log(err)
                        expect.fail(err)
                    } else {
                        expect(res.text).to.be.equal('Required storage-service not available')
                    }
                    done()
                })
        })

        it('should send code 200 and data if service found (1 sensor)', function(done) {
            let ssMock = {
                name: 'storage',
                getDevices: sinon.stub().resolves({}),
                getSensors: sinon.stub().resolves({
                    'id1': {
                        sensorId: 'id1',
                        sensorLabel: 'label1',
                        sensorValue: 12.34,
                        device: {
                            deviceId: 'deviceid1',
                            deviceName: 'devicename1'
                        }
                    }
                })
            }
            registerService({
                name: 'log',
                error: sinon.fake()
            })
            registerService(ssMock)
            
            request.get('/scrapedata')
                .expect('Content-Type', 'text/plain; charset=utf-8')
                .expect(200, (err, res) => {
                    if (err) {
                        return done(err)
                    } else {
                        expect(res.text).to.be.equal('sensor_label1{sensorId="id1",deviceId="deviceid1",deviceName="devicename1"} 12.34')
                    }
                    done()
                })
        })

        it('should send code 200 and data if service found (2 sensors)', function(done) {
            let ssMock = {
                name: 'storage',
                getDevices: sinon.stub(),
                getSensors: sinon.stub().resolves({
                    'id1': {
                        sensorId: 'id1',
                        sensorLabel: 'label1',
                        sensorValue: 12.34,
                        device: {
                            deviceId: 'deviceid1',
                            deviceName: 'devicename1'
                        }
                    },
                    'id2': {
                        sensorId: 'id2',
                        sensorLabel: 'label2',
                        sensorValue: 2.34,
                        device: {
                            deviceId: 'deviceid2',
                            deviceName: 'devicename2'
                        }
                    }
                })
            }
            
            registerService({
                name: 'log',
                error: sinon.fake()
            })
            registerService(ssMock)

            request.get('/scrapedata')
                .expect('Content-Type', 'text/plain; charset=utf-8')
                .expect(200, (err, res) => {
                    if (err) {
                        return done(err)
                    } else {
                        expect(res.text).to.be.equal(`sensor_label1{sensorId="id1",deviceId="deviceid1",deviceName="devicename1"} 12.34
sensor_label2{sensorId="id2",deviceId="deviceid2",deviceName="devicename2"} 2.34`)
                    }
                    done()
                })
        })

        it('should send code 200 and data if service found (no sensor label etc)', function(done) {
            let ssMock = {
                name: 'storage',
                getDevices: sinon.stub(),
                getSensors: sinon.stub().resolves({
                    'id1': {
                        sensorId: 'id1',
                        sensorLabel: undefined,
                        sensorValue: 12.34,
                        device: {
                            deviceId: undefined,
                            deviceName: undefined
                        }
                    }
                })
            }
            
            registerService({
                name: 'log',
                error: sinon.fake()
            })
            registerService(ssMock)

            request.get('/scrapedata')
                .expect('Content-Type', 'text/plain; charset=utf-8')
                .expect(200, (err, res) => {
                    if (err) {
                        console.log(err)
                        expect.fail(err)
                    } else {
                        expect(res.text).to.be.equal('sensor_nolabelid1{sensorId="id1",deviceId="unknown",deviceName="unknown"} 12.34')
                    }
                    done()
                })
        })
    })

    describe('test device', function() {
        it('should send code 200 and device data back for devices (1 device)', function(done) {
            registerService({
                name: 'log',
                error: sinon.fake()
            })
            registerService({
                name: 'storage',
                getSensors: sinon.stub().resolves({}),
                getDevices: sinon.stub().resolves({
                    'deviceid1': {
                        deviceId: 'deviceid1',
                        deviceName: 'devicename1',
                        restarts: 5
                    }
                })
            })
            
            request.get('/scrapedata')
                .expect('Content-Type', 'text/plain; charset=utf-8')
                .expect(200, (err, res) => {
                    if (err) {
                        console.log(err)
                        return done(err)
                    } else {
                        expect(res.text).to.be.equal(`device_restart{deviceId="deviceid1",deviceName="devicename1"} 5
device_watchdog_reset{deviceId="deviceid1",deviceName="devicename1"} 0`)
                    }
                    done()
                })
        })
        it('should send code 200 and device data back for devices (2 device)', function(done) {
            registerService({
                name: 'log',
                error: sinon.fake()
            })
            registerService({
                name: 'storage',
                getSensors: sinon.stub().resolves({}),
                getDevices: sinon.stub().resolves({
                    'deviceid1': {
                        deviceId: 'deviceid1',
                        deviceName: 'devicename1',
                        restarts: 5,
                        watchdogResets: 3
                    },
                    'deviceid2': {
                        deviceId: 'deviceid2',
                        deviceName: 'devicename2'
                    }
                })
            })
            
            request.get('/scrapedata')
                .expect('Content-Type', 'text/plain; charset=utf-8')
                .expect(200, (err, res) => {
                    if (err) {
                        console.log(err)
                        return done(err)
                    } else {
                        expect(res.text).to.be.equal(`device_restart{deviceId="deviceid1",deviceName="devicename1"} 5
device_restart{deviceId="deviceid2",deviceName="devicename2"} 0
device_watchdog_reset{deviceId="deviceid1",deviceName="devicename1"} 3
device_watchdog_reset{deviceId="deviceid2",deviceName="devicename2"} 0`)
                    }
                    done()
                })
        })
    })
})
