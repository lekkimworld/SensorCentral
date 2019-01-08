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
                        expect(res.text).to.be.equal('Required service not available')
                    }
                    done()
                })
        })

        it('should send code 200 and data if service found (1 sensor)', function(done) {
            registerService({
                name: 'storage',
                getDeviceIds: sinon.fake.returns([]),
                getSensorIds: sinon.fake.returns(['id1']),
                getSensorById: sinon.fake.returns({
                    sensorId: 'id1',
                    sensorLabel: 'label1',
                    sensorValue: 12.34,
                    device: {
                        deviceId: 'deviceid1',
                        deviceName: 'devicename1'
                    }
                })
            })
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
            let f = (id) => {
                if (id === 'id1') return {
                    sensorId: 'id1',
                    sensorLabel: 'label1',
                    sensorValue: 12.34,
                    device: {
                        deviceId: 'deviceid1',
                        deviceName: 'devicename1'
                    }
                }
                if (id === 'id2') return {
                    sensorId: 'id2',
                    sensorLabel: 'label2',
                    sensorValue: 2.34,
                    device: {
                        deviceId: 'deviceid2',
                        deviceName: 'devicename2'
                    }
                }
                return undefined
            }
            registerService({
                name: 'storage',
                getDeviceIds: sinon.fake.returns([]),
                getSensorIds: sinon.fake.returns(['id1','id2']),
                getSensorById: f
            })
            
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
            registerService({
                name: 'storage',
                getSensorIds: sinon.fake.returns(['id1']),
                getSensorById: sinon.fake.returns({
                    sensorId: 'id1',
                    sensorLabel: undefined,
                    sensorValue: 12.34,
                    device: {
                        deviceId: undefined,
                        deviceName: undefined
                    }
                })
            })
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
            let f = (id) => {
                if (id === 'deviceid1') return {
                    deviceId: 'deviceid1',
                    deviceName: 'devicename1',
                    restarts: 5
                }
                return undefined
            }
            registerService({
                name: 'storage',
                getSensorIds: sinon.fake.returns([]),
                getSensorById: () => undefined,
                getDeviceIds: sinon.fake.returns(['deviceid1']),
                getDeviceById: f
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
            let f = (id) => {
                if (id === 'deviceid1') return {
                    deviceId: 'deviceid1',
                    deviceName: 'devicename1',
                    restarts: 5,
                    watchdogResets: 3
                }
                if (id === 'deviceid2') return {
                    deviceId: 'deviceid2',
                    deviceName: 'devicename2'
                }
                return undefined
            }
            registerService({
                name: 'storage',
                getSensorIds: sinon.fake.returns([]),
                getSensorById: () => undefined,
                getDeviceIds: sinon.fake.returns(['deviceid1','deviceid2']),
                getDeviceById: f
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
