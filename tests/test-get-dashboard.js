const sinon = require('sinon')
const {expect} = require('chai')
const {registerService, terminate} = require('../src/configure-services.js')
const supertest = require('supertest')
const express = require('express')
const moment = require('moment')
const constants = require('../src/constants.js')

const CONTEXT = '/dashboard'

describe('test-get-dashboard', function() {
    let request
    beforeEach(function() {
        terminate()

        const app = express()
        app.engine('handlebars', (filePath, options, callback) => {
            let keys = ['updated','data']
            let obj = {}
            Object.keys(options).forEach(key => {
                if (keys.includes(key)) obj[key] = options[key]
            })
            return callback(undefined, JSON.stringify(obj))
        })
        app.set('view engine', 'handlebars')
        app.use(require('../src/routes/get-dashboard.js'))
        request = supertest(app)
    })

    it('should send code 500 if no service', function(done) {
        request.get(CONTEXT)
            .expect('Content-Type', 'text/html; charset=utf-8')
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

    it('should send data return based on storage data', function(done) {
        registerService({
            name: 'storage',
            getInstance: sinon.fake.returns({
                'id1': {
                    sensorId: 'id1',
                    sensorName: 'name1',
                    sensorLabel: 'label1',
                    sensorValue: 12.34123,
                    sensorType: 'temp',
                    sensorDt: moment().add(-5, 'minutes').valueOf(),
                    deviceId: 'deviceid1',
                    deviceName: 'devicename1'
                },
                'id2': {
                    sensorId: 'id2',
                    sensorLabel: undefined,
                    sensorValue: 34.34,
                    sensorDt: undefined, 
                    deviceId: undefined,
                    deviceName: undefined
                }
            })
        })
        request.get(CONTEXT)
            .expect('Content-Type', 'text/html; charset=utf-8')
            .expect(200, (err, res) => {
                if (err) {
                    console.log(err)
                    expect.fail(err)
                } else {
                    let obj = JSON.parse(res.text)
                    expect(obj).to.include.key('updated')
                    expect(obj).to.include.key('data')
                    
                    let dataElem1 = obj.data.filter(e => e.raw.sensor.id === 'id1')[0]
                    expect(dataElem1.value).to.equal('12.34\u00B0C')
                    expect(dataElem1.name).to.equal('name1 (devicename1)')
                    expect(dataElem1.dt).to.equal(moment().add(-5, 'minutes').tz('Europe/Copenhagen').format("D-M-YYYY [kl.] k:mm"))
                    expect(dataElem1.last).to.equal(5)
                    expect(dataElem1.raw.sensor.id).to.equal('id1')
                    expect(dataElem1.raw.sensor.name).to.equal('name1')
                    expect(dataElem1.raw.sensor.label).to.equal('label1')
                    expect(dataElem1.raw.sensor.value).to.equal(12.34123)
                    expect(dataElem1.raw.sensor.denominator).to.equal(constants.SENSOR_TYPES.TEMPERATURE.denominator)
                    expect(dataElem1.raw.sensor.type).to.equal(constants.SENSOR_TYPES.TEMPERATURE.type)
                    expect(dataElem1.raw.device.id).to.equal('deviceid1')
                    expect(dataElem1.raw.device.name).to.equal('devicename1')
                    
                    let dataElem2 = obj.data.filter(e => e.raw.sensor.id === 'id2')[0]
                    expect(dataElem2.value).to.equal('34.34(??)')
                    expect(dataElem2.name).to.equal('NN (NN)')
                    expect(dataElem2.raw.sensor.id).to.equal('id2')
                    expect(dataElem2.raw.sensor.name).to.be.undefined
                    expect(dataElem2.raw.sensor.label).to.be.undefined
                    expect(dataElem2.raw.sensor.value).to.equal(34.34)
                    expect(dataElem2.raw.sensor.denominator).to.equal(constants.SENSOR_TYPES.UNKNOWN.denominator)
                    expect(dataElem2.raw.sensor.type).to.equal(constants.SENSOR_TYPES.UNKNOWN.type)
                    expect(dataElem2.raw.device.id).to.be.undefined
                    expect(dataElem2.raw.device.name).to.be.undefined
                    
                }
                done()
            })
    })

})