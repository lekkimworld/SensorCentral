const sinon = require('sinon')
const {expect} = require('chai')
const {registerService, reset} = require('../src/configure-services.js')
const supertest = require('supertest')
const express = require('express')
const moment = require('moment')

const CONTEXT = '/dashboard'

describe('test-get-dashboard', function() {
    let request
    beforeEach(function() {
        reset()

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
                    sensorLabel: 'label1',
                    sensorValue: 12.34,
                    sensorDt: moment.utc().days(31).month(12).year(2018).hour(20).minute(45).second(45).valueOf(),
                    deviceId: 'deviceid1',
                    deviceName: 'devicename1'
                },
                'id2': {
                    sensorId: 'id2',
                    sensorLabel: 'label2',
                    sensorValue: 12.34,
                    sensorDt: undefined, 
                    deviceId: 'deviceid2',
                    deviceName: 'devicename2'
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

                }
                done()
            })
    })

})