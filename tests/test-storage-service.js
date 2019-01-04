const sinon = require('sinon')
const {expect} = require('chai')
const StorageService = require('../src/services/storage-service.js')
const {registerService, reset} = require('../src/configure-services.js')

describe('storage-service tests', function() {
    this.beforeEach(function() {
        reset()
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
                            devicename: ' devicename1',
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
                expect(ss._storage).not.to.be.empty
                expect(Object.keys(ss._storage).length).to.be.equal(1)

                // lookup with uppercase ID as we expect it to be uppercased
                expect(ss._storage['id1']).to.have.keys(['sensorId', 'sensorName', 'sensorLabel', 'sensorType','sensorValue','sensorDt','deviceId','deviceName'])
                expect(ss._storage['id1'].deviceId).to.be.equal('deviceid1')
                done()
            })
            
            
        })
    })
})

