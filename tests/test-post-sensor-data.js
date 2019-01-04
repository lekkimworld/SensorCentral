const sinon = require('sinon')
const {expect} = require('chai')
const {registerService, lookupService, reset} = require('../src/configure-services.js')
const supertest = require('supertest')
const express = require('express')
const constants = require('../src/constants.js')
const bodyparser = require('body-parser')

let eventPublishMethod

describe('test-post-sensor-data', function() {
    let request
    beforeEach(function(done) {
        reset()
        
        eventPublishMethod = sinon.stub().returns(Promise.resolve())
        registerService({
            'name': 'log',
            'debug': sinon.stub(),
            'info': sinon.stub()
        }).then(() => {
            return registerService({
                'name': 'event',
                'getInstance': sinon.fake.returns({
                    'publish': eventPublishMethod
                })
            })
        }).then(() => {
            const app = express()
            app.use(bodyparser.json())
            app.use(require('../src/routes/post-sensor-data.js'))
            request = supertest(app)

            // beforeEach done
            done()
        })
    })

    it('should send code 200 and data back', function(done) {
        request.post('/').send({
            'foo': 'bar'
        }).set('Accept', 'application/json')
            .expect('Content-Type', 'text/plain; charset=utf-8')
            .expect(200)
            .end((err, res) => {
                if (err) {
                    expect.fail(err)
                } else {
                    expect(res.text.substring(0, 24)).to.be.equal('Thank you - you posted: ')
                    let obj = JSON.parse(res.text.substring(24))
                    expect(obj.msgtype).to.be.equal('data')
                    expect(obj.data.length).to.be.equal(1)
                }
                done()
            })
    })

    it('should send code 500 if no services', function(done) {
        reset()

        request.post('/').send({
            'foo': 'bar'
        }).set('Accept', 'application/json').expect('Content-Type', 'text/plain; charset=utf-8')
            .expect(500)
            .end((err, res) => {
                if (err) {
                    expect.fail(err)
                } else {
                    expect(res.text).to.be.equal('Unable to find event bus')
                }
                done()
            })
    })

    it('verify that event posted if a control message', function(done) {
        request.post('/').send({
            msgtype: 'control',
            data: {
                'foo': 'bar'
            }
        }).set('Accept', 'application/json')
            .expect(200)
            .end((err, res) => {
                if (err) {
                    expect.fail(err)
                } else {
                    expect(eventPublishMethod.callCount).to.be.equal(1)
                    expect(eventPublishMethod.firstCall.args[0].channel).to.be.equal(constants.PUBNUB.CTRL_CHANNEL)
                    expect(eventPublishMethod.firstCall.args[0].message.foo).to.be.equal('bar')
                }
                done()
            })
    })

    
})
