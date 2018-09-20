const sinon = require('sinon')
const {expect} = require('chai')
const {registerService, reset} = require('../src/configure-services.js')
const supertest = require('supertest')
const express = require('express')

describe('test-prometheus-scape-endpoint', function() {
    let request
    beforeEach(function() {
        reset()

        const app = express()
        app.use(require('../src/routes/prometheus-scape-endpoint.js'))
        request = supertest(app)
    })

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
            getInstance: sinon.fake.returns({
                'id1': {
                    sensorId: 'id1',
                    sensorLabel: 'label1',
                    sensorValue: 12.34,
                    deviceId: 'deviceid1',
                    deviceName: 'devicename1'
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
                    expect(res.text).to.be.equal('sensor_label1{sensorId="id1",deviceId="deviceid1",deviceName="devicename1"} 12.34\n')
                }
                done()
            })
    })

    it('should send code 200 and data if service found (2 sensors)', function(done) {
        registerService({
            name: 'storage',
            getInstance: sinon.fake.returns({
                'id1': {
                    sensorId: 'id1',
                    sensorLabel: 'label1',
                    sensorValue: 12.34,
                    deviceId: 'deviceid1',
                    deviceName: 'devicename1'
                },
                'id2': {
                    sensorId: 'id2',
                    sensorLabel: 'label2',
                    sensorValue: 12.34,
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
                    expect.fail(err)
                } else {
                    expect(res.text).to.be.equal('sensor_label1{sensorId="id1",deviceId="deviceid1",deviceName="devicename1"} 12.34\nsensor_label2{sensorId="id2",deviceId="deviceid2",deviceName="devicename2"} 12.34\n')
                }
                done()
            })
    })

    it('should send code 200 and data if service found (no sensor label etc)', function(done) {
        registerService({
            name: 'storage',
            getInstance: sinon.fake.returns({
                'id1': {
                    sensorId: 'id1',
                    sensorLabel: undefined,
                    sensorValue: 12.34,
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
                    expect(res.text).to.be.equal('sensor_nolabelid1{sensorId="id1",deviceId="unknown",deviceName="unknown"} 12.34\n')
                }
                done()
            })
    })
})