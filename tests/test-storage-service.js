const sinon = require('sinon')
const {expect} = require('chai')
const StorageService = require('../src/services/storage-service.js')
const {registerService, terminate} = require('../src/configure-services.js')
const constants = require('../src/constants.js')

describe('storage-service tests', function() {
    const _buildRedisClient = StorageService.prototype._buildRedisClient;
    this.beforeEach(() => {
        StorageService.prototype._buildRedisClient = _buildRedisClient;
    })
    this.afterEach(function() {
        terminate()
    })

    describe('simple tests', function() {
        it('should set correct name', function() {
            StorageService.prototype._buildRedisClient = sinon.fake.returns({});
            expect(new StorageService().name).to.be.equal('storage')
        })
        it('should have correct dependencies', function() {
            StorageService.prototype._buildRedisClient = sinon.fake.returns({});
            expect(new StorageService().dependencies).to.be.deep.equal(['db', 'log', 'event'])
        })
    })

    describe('initialization tests', function() {
        it('should wait for dependencies', function(done) {
            let dbsvc = {
                name: 'db',
                init: sinon.stub().callsArg(0),
                query: sinon.fake.resolves({
                    rows: []
                })
            }
            let eventsvc = {
                name: 'event',
                init: sinon.stub().callsArg(0),
                getInstance: sinon.fake.returns({
                    addListener: sinon.fake(),
                    subscribe: sinon.fake()
                }),
                subscribe: sinon.fake()
            }
            let logsvc = {
                name: 'log',
                init: sinon.stub().callsArg(0)
            }
            registerService(dbsvc)
            registerService(logsvc)
            registerService(eventsvc)
            
            StorageService.prototype._buildRedisClient = sinon.fake.returns({})
            
            let ss = new StorageService()
            registerService(ss).then(svc => {
                done()

            }).catch(err => {
                done(err)
            })
        })

        it('should initialize redis based on database query', function(done) {
            let dbsvc = {
                name: 'db',
                init: sinon.stub().yields(),
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
                init: sinon.stub().yields(),
                getInstance: sinon.fake.returns({
                    addListener: sinon.fake(),
                    subscribe: sinon.fake()
                }),
                subscribe: sinon.fake()
            }
            let logsvc = {
                name: 'log',
                init: sinon.stub().yields()
            }
            registerService(dbsvc)
            registerService(logsvc)
            registerService(eventsvc)
            
            const redisMock = {
                get: sinon.stub().resolves(undefined),
                setex: sinon.stub().resolves(undefined)
            };
            redisMock.setex.onCall(0).resolves(JSON.stringify({
                'deviceId': 'deviceid1',
                'deviceName': 'devicename1'
            }))
            StorageService.prototype._buildRedisClient = sinon.fake.returns(redisMock)
            
            let ss = new StorageService()
            registerService(ss).then(svc => {
                expect(dbsvc.query.callCount).to.be.equal(1)
                expect(dbsvc.query.firstCall.args[0]).to.be.equal('select s.id sensorId, s.name sensorName, s.label sensorLabel, s.type sensorType, d.id deviceId, d.name deviceName from sensor s, device d where s.deviceId=d.id')
                
                expect(redisMock.get.callCount).to.be.equal(2);
                expect(redisMock.get.firstCall.args[0]).to.be.equal('sensor:id1');
                expect(redisMock.get.secondCall.args[0]).to.be.equal('device:deviceid1');

                expect(redisMock.setex.callCount).to.be.equal(2)
                expect(redisMock.setex.firstCall.args[0]).to.be.equal('device:deviceid1')
                expect(redisMock.setex.firstCall.args[1]).to.be.equal(600);
                expect(typeof redisMock.setex.firstCall.args[2]).to.be.equal('string')
                expect(JSON.parse(redisMock.setex.firstCall.args[2])).to.have.property('deviceId', 'deviceid1');
                expect(JSON.parse(redisMock.setex.firstCall.args[2])).to.have.property('deviceName', 'devicename1');
                expect(JSON.parse(redisMock.setex.firstCall.args[2])).to.have.property('restarts', 0);
                expect(JSON.parse(redisMock.setex.firstCall.args[2])).to.have.property('watchdogResets', 0);

                expect(redisMock.setex.secondCall.args[0]).to.be.equal('sensor:id1')
                expect(redisMock.setex.secondCall.args[1]).to.be.equal(600);
                expect(typeof redisMock.setex.secondCall.args[2]).to.be.equal('string')
                expect(JSON.parse(redisMock.setex.secondCall.args[2])).to.have.property('sensorName', 'name1');
                expect(JSON.parse(redisMock.setex.secondCall.args[2])).to.have.property('sensorLabel', 'label1');
                expect(JSON.parse(redisMock.setex.secondCall.args[2])).to.have.property('sensorId', 'id1');
                expect(JSON.parse(redisMock.setex.secondCall.args[2])).to.have.property('sensorType', 'temp');
                expect(JSON.parse(redisMock.setex.secondCall.args[2])).to.have.property('sensorValue', Number.MIN_VALUE);
                expect(JSON.parse(redisMock.setex.secondCall.args[2]).sensorDt).to.be.undefined;
                expect(JSON.parse(redisMock.setex.secondCall.args[2])).to.have.property('device');
                done()

            }).catch(err => {
                done(err)
            })
        })
    })

    describe('sensor member methods', function() {
        it('getSensors (no sensors)', function(done) {
            let dbsvc = {
                name: 'db',
                init: sinon.stub().yields(),
                query: sinon.fake.resolves({
                    rows: []
                })
            }
            let eventsvc = {
                name: 'event',
                init: sinon.stub().yields(),
                getInstance: sinon.fake.returns({
                    addListener: sinon.fake(),
                    subscribe: sinon.fake()
                }),
                subscribe: sinon.fake()
            }
            let logsvc = {
                name: 'log',
                init: sinon.stub().yields()
            }
            registerService(dbsvc)
            registerService(logsvc)
            registerService(eventsvc)
            
            const redisMock = {
                keys: sinon.stub().resolves([]),
                mget: sinon.stub().resolves([])
            };
            StorageService.prototype._buildRedisClient = sinon.fake.returns(redisMock)
            
            let ss = new StorageService()
            registerService(ss).then(svc => {
                ss.getSensors().then(data => {
                    expect(data).to.deep.equal({});

                    expect(redisMock.keys.callCount).to.equal(1);
                    expect(redisMock.keys.firstCall.args[0]).to.equal('sensor:*');
                    expect(redisMock.mget.callCount).to.equal(1);
                    expect(redisMock.mget.firstCall.args[0]).to.deep.equal([]);
                });
                done()

            }).catch(err => {
                done(err)
            })
        })

        it('getSensors (1 sensor)', function(done) {
            let dbsvc = {
                name: 'db',
                init: sinon.stub().yields(),
                query: sinon.fake.resolves({
                    rows: []
                })
            }
            let eventsvc = {
                name: 'event',
                init: sinon.stub().yields(),
                getInstance: sinon.fake.returns({
                    addListener: sinon.fake(),
                    subscribe: sinon.fake()
                }),
                subscribe: sinon.fake()
            }
            let logsvc = {
                name: 'log',
                init: sinon.stub().yields()
            }
            registerService(dbsvc)
            registerService(logsvc)
            registerService(eventsvc)
            
            const redisMock = {
                keys: sinon.stub().resolves(['sensor:id1']),
                mget: sinon.stub().resolves([JSON.stringify({'sensorId': 'id1','sensorName':'name1'})])
            };
            StorageService.prototype._buildRedisClient = sinon.fake.returns(redisMock)
            
            let ss = new StorageService()
            registerService(ss).then(svc => {
                ss.getSensors().then(data => {
                    expect(data).to.have.keys(['id1']);
                    expect(data.id1).to.deep.equal({'sensorId': 'id1','sensorName':'name1'})

                    expect(redisMock.keys.callCount).to.equal(1);
                    expect(redisMock.keys.firstCall.args[0]).to.equal('sensor:*');
                    expect(redisMock.mget.callCount).to.equal(1);
                    expect(redisMock.mget.firstCall.args[0]).to.deep.equal(['sensor:id1']);
                });
                done()

            }).catch(err => {
                done(err)
            })
        })

        it('getSensors (2 sensors)', function(done) {
            let dbsvc = {
                name: 'db',
                init: sinon.stub().yields(),
                query: sinon.fake.resolves({
                    rows: []
                })
            }
            let eventsvc = {
                name: 'event',
                init: sinon.stub().yields(),
                getInstance: sinon.fake.returns({
                    addListener: sinon.fake(),
                    subscribe: sinon.fake()
                }),
                subscribe: sinon.fake()
            }
            let logsvc = {
                name: 'log',
                init: sinon.stub().yields()
            }
            registerService(dbsvc)
            registerService(logsvc)
            registerService(eventsvc)
            
            const redisMock = {
                keys: sinon.stub().resolves(['sensor:id1','sensor:id2']),
                mget: sinon.stub().resolves([JSON.stringify({'sensorId': 'id1','sensorName':'name1'}),JSON.stringify({'sensorId': 'id2','sensorName':'name2'})])
            };
            StorageService.prototype._buildRedisClient = sinon.fake.returns(redisMock)
            
            let ss = new StorageService()
            registerService(ss).then(svc => {
                ss.getSensors().then(data => {
                    expect(data).to.have.keys(['id1','id2']);
                    expect(data.id1).to.deep.equal({'sensorId': 'id1','sensorName':'name1'});
                    expect(data.id2).to.deep.equal({'sensorId': 'id2','sensorName':'name2'});

                    expect(redisMock.keys.callCount).to.equal(1);
                    expect(redisMock.keys.firstCall.args[0]).to.equal('sensor:*');
                    expect(redisMock.mget.callCount).to.equal(1);
                    expect(redisMock.mget.firstCall.args[0]).to.deep.equal(['sensor:id1','sensor:id2']);
                });
                done()

            }).catch(err => {
                done(err)
            })
        })

        it('getSensorIds (no sensors)', function(done) {
            let dbsvc = {
                name: 'db',
                init: sinon.stub().yields(),
                query: sinon.fake.resolves({
                    rows: []
                })
            }
            let eventsvc = {
                name: 'event',
                init: sinon.stub().yields(),
                getInstance: sinon.fake.returns({
                    addListener: sinon.fake(),
                    subscribe: sinon.fake()
                }),
                subscribe: sinon.fake()
            }
            let logsvc = {
                name: 'log',
                init: sinon.stub().yields()
            }
            registerService(dbsvc)
            registerService(logsvc)
            registerService(eventsvc)
            
            const redisMock = {
                keys: sinon.stub().resolves([]),
                mget: sinon.stub().resolves([])
            };
            StorageService.prototype._buildRedisClient = sinon.fake.returns(redisMock)
            
            let ss = new StorageService()
            registerService(ss).then(svc => {
                ss.getSensorIds().then(data => {
                    expect(data).to.deep.equal([]);
                    
                    expect(redisMock.keys.callCount).to.equal(1);
                    expect(redisMock.keys.firstCall.args[0]).to.equal('sensor:*');
                });
                done()

            }).catch(err => {
                done(err)
            })
        })

        it('getSensorIds (1 sensor)', function(done) {
            let dbsvc = {
                name: 'db',
                init: sinon.stub().yields(),
                query: sinon.fake.resolves({
                    rows: []
                })
            }
            let eventsvc = {
                name: 'event',
                init: sinon.stub().yields(),
                getInstance: sinon.fake.returns({
                    addListener: sinon.fake(),
                    subscribe: sinon.fake()
                }),
                subscribe: sinon.fake()
            }
            let logsvc = {
                name: 'log',
                init: sinon.stub().yields()
            }
            registerService(dbsvc)
            registerService(logsvc)
            registerService(eventsvc)
            
            const redisMock = {
                keys: sinon.stub().resolves(['sensor:id1'])
            };
            StorageService.prototype._buildRedisClient = sinon.fake.returns(redisMock)
            
            let ss = new StorageService()
            registerService(ss).then(svc => {
                ss.getSensorIds().then(data => {
                    expect(data).to.deep.equal(['id1']);
                    
                    expect(redisMock.keys.callCount).to.equal(1);
                    expect(redisMock.keys.firstCall.args[0]).to.equal('sensor:*');
                });
                done()

            }).catch(err => {
                done(err)
            })
        })

        it('getSensorIds (2 sensors)', function(done) {
            let dbsvc = {
                name: 'db',
                init: sinon.stub().yields(),
                query: sinon.fake.resolves({
                    rows: []
                })
            }
            let eventsvc = {
                name: 'event',
                init: sinon.stub().yields(),
                getInstance: sinon.fake.returns({
                    addListener: sinon.fake(),
                    subscribe: sinon.fake()
                }),
                subscribe: sinon.fake()
            }
            let logsvc = {
                name: 'log',
                init: sinon.stub().yields()
            }
            registerService(dbsvc)
            registerService(logsvc)
            registerService(eventsvc)
            
            const redisMock = {
                keys: sinon.stub().resolves(['sensor:id1','sensor:foo'])
            };
            StorageService.prototype._buildRedisClient = sinon.fake.returns(redisMock)
            
            let ss = new StorageService()
            registerService(ss).then(svc => {
                ss.getSensorIds().then(data => {
                    expect(data).to.deep.equal(['id1','foo']);
                    
                    expect(redisMock.keys.callCount).to.equal(1);
                    expect(redisMock.keys.firstCall.args[0]).to.equal('sensor:*');
                });
                done()

            }).catch(err => {
                done(err)
            })
        })

        it('getSensorById (no sensor found)', function(done) {
            let dbsvc = {
                name: 'db',
                init: sinon.stub().yields(),
                query: sinon.fake.resolves({
                    rows: []
                })
            }
            let eventsvc = {
                name: 'event',
                init: sinon.stub().yields(),
                getInstance: sinon.fake.returns({
                    addListener: sinon.fake(),
                    subscribe: sinon.fake()
                }),
                subscribe: sinon.fake()
            }
            let logsvc = {
                name: 'log',
                init: sinon.stub().yields()
            }
            registerService(dbsvc)
            registerService(logsvc)
            registerService(eventsvc)
            
            const redisMock = {
                get: sinon.stub().resolves(undefined)
            };
            StorageService.prototype._buildRedisClient = sinon.fake.returns(redisMock)
            
            let ss = new StorageService()
            registerService(ss).then(svc => {
                ss.getSensorById('foo').then(data => {
                    expect(data).to.be.undefined
                    
                    expect(redisMock.get.callCount).to.equal(1);
                    expect(redisMock.get.firstCall.args[0]).to.equal('sensor:foo');
                });
                done()

            }).catch(err => {
                done(err)
            })
        })

        it('getSensorById (sensor found)', function(done) {
            let dbsvc = {
                name: 'db',
                init: sinon.stub().yields(),
                query: sinon.fake.resolves({
                    rows: []
                })
            }
            let eventsvc = {
                name: 'event',
                init: sinon.stub().yields(),
                getInstance: sinon.fake.returns({
                    addListener: sinon.fake(),
                    subscribe: sinon.fake()
                }),
                subscribe: sinon.fake()
            }
            let logsvc = {
                name: 'log',
                init: sinon.stub().yields()
            }
            registerService(dbsvc)
            registerService(logsvc)
            registerService(eventsvc)
            
            const redisMock = {
                get: sinon.stub().resolves(JSON.stringify({'sensorId': 'foo'}))
            };
            StorageService.prototype._buildRedisClient = sinon.fake.returns(redisMock)
            
            let ss = new StorageService()
            registerService(ss).then(svc => {
                ss.getSensorById('foo').then(data => {
                    expect(data).to.deep.equal({'sensorId': 'foo'})
                    
                    expect(redisMock.get.callCount).to.equal(1);
                    expect(redisMock.get.firstCall.args[0]).to.equal('sensor:foo');
                });
                done()

            }).catch(err => {
                done(err)
            })
        })
    })

    describe('device member methods', function() {
        it('should return the unique deviceIds for the supplied sensorIds', function(done) {
            let dbsvc = {
                name: 'db',
                init: sinon.fake.yields(),
                query: sinon.fake.resolves({
                    rows: []
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
                init: sinon.fake.yields(),
                name: 'log'
            }
            registerService(dbsvc)
            registerService(logsvc)
            registerService(eventsvc)
            
            const redisMock = {
                mget: sinon.stub().resolves([
                    JSON.stringify({'sensorId': 'id1', 'device': {'deviceId': 'foo1','deviceName':'bar1'}}), 
                    JSON.stringify({'sensorId': 'id2', 'device': {'deviceId': 'foo2','deviceName':'bar2'}})
                ])
            };
            StorageService.prototype._buildRedisClient = sinon.fake.returns(redisMock)
            
            let ss = new StorageService()
            registerService(ss).then(svc => {
                ss.getDeviceIdsForSensorsIds(['id1', undefined, 'id2']).then(deviceIds => {
                    expect(deviceIds).to.deep.equal(['foo1', 'foo2']);
                    
                    expect(redisMock.mget.callCount).to.equal(1);
                    expect(redisMock.mget.firstCall.args[0]).to.deep.equal(['sensor:id1', 'sensor:id2']);

                    done()
                })
                
            }).catch(err => {
                done(err);
            })
            
        })

        it('getDevices (no devices)', function(done) {
            let dbsvc = {
                name: 'db',
                init: sinon.stub().yields(),
                query: sinon.fake.resolves({
                    rows: []
                })
            }
            let eventsvc = {
                name: 'event',
                init: sinon.stub().yields(),
                getInstance: sinon.fake.returns({
                    addListener: sinon.fake(),
                    subscribe: sinon.fake()
                }),
                subscribe: sinon.fake()
            }
            let logsvc = {
                name: 'log',
                init: sinon.stub().yields()
            }
            registerService(dbsvc)
            registerService(logsvc)
            registerService(eventsvc)
            
            const redisMock = {
                keys: sinon.stub().resolves([]),
                mget: sinon.stub().resolves([])
            };
            StorageService.prototype._buildRedisClient = sinon.fake.returns(redisMock)
            
            let ss = new StorageService()
            registerService(ss).then(svc => {
                ss.getDevices().then(data => {
                    expect(data).to.deep.equal({});

                    expect(redisMock.keys.callCount).to.equal(1);
                    expect(redisMock.keys.firstCall.args[0]).to.equal('device:*');
                    expect(redisMock.mget.callCount).to.equal(1);
                    expect(redisMock.mget.firstCall.args[0]).to.deep.equal([]);
                });
                done()

            }).catch(err => {
                done(err)
            })
        })

        it('getDevices (1 device)', function(done) {
            let dbsvc = {
                name: 'db',
                init: sinon.stub().yields(),
                query: sinon.fake.resolves({
                    rows: []
                })
            }
            let eventsvc = {
                name: 'event',
                init: sinon.stub().yields(),
                getInstance: sinon.fake.returns({
                    addListener: sinon.fake(),
                    subscribe: sinon.fake()
                }),
                subscribe: sinon.fake()
            }
            let logsvc = {
                name: 'log',
                init: sinon.stub().yields()
            }
            registerService(dbsvc)
            registerService(logsvc)
            registerService(eventsvc)
            
            const redisMock = {
                keys: sinon.stub().resolves(['device:foo']),
                mget: sinon.stub().resolves([JSON.stringify({'deviceId': 'foo','deviceName':'bar'})])
            };
            StorageService.prototype._buildRedisClient = sinon.fake.returns(redisMock)
            
            let ss = new StorageService()
            registerService(ss).then(svc => {
                ss.getDevices().then(data => {
                    expect(data).to.have.keys(['foo']);
                    expect(data.foo).to.deep.equal({'deviceId': 'foo','deviceName':'bar'})

                    expect(redisMock.keys.callCount).to.equal(1);
                    expect(redisMock.keys.firstCall.args[0]).to.equal('device:*');
                    expect(redisMock.mget.callCount).to.equal(1);
                    expect(redisMock.mget.firstCall.args[0]).to.deep.equal(['device:foo']);
                });
                done()

            }).catch(err => {
                done(err)
            })
        })

        it('getDevices (2 devices)', function(done) {
            let dbsvc = {
                name: 'db',
                init: sinon.stub().yields(),
                query: sinon.fake.resolves({
                    rows: []
                })
            }
            let eventsvc = {
                name: 'event',
                init: sinon.stub().yields(),
                getInstance: sinon.fake.returns({
                    addListener: sinon.fake(),
                    subscribe: sinon.fake()
                }),
                subscribe: sinon.fake()
            }
            let logsvc = {
                name: 'log',
                init: sinon.stub().yields()
            }
            registerService(dbsvc)
            registerService(logsvc)
            registerService(eventsvc)
            
            const redisMock = {
                keys: sinon.stub().resolves(['device:foo1','device:foo2']),
                mget: sinon.stub().resolves([JSON.stringify({'deviceId': 'foo1','deviceName':'name1'}),JSON.stringify({'deviceId': 'foo2','deviceName':'name2'})])
            };
            StorageService.prototype._buildRedisClient = sinon.fake.returns(redisMock)
            
            let ss = new StorageService()
            registerService(ss).then(svc => {
                ss.getDevices().then(data => {
                    expect(data).to.have.keys(['foo1','foo2']);
                    expect(data.foo1).to.deep.equal({'deviceId': 'foo1','deviceName':'name1'});
                    expect(data.foo2).to.deep.equal({'deviceId': 'foo2','deviceName':'name2'});

                    expect(redisMock.keys.callCount).to.equal(1);
                    expect(redisMock.keys.firstCall.args[0]).to.equal('device:*');
                    expect(redisMock.mget.callCount).to.equal(1);
                    expect(redisMock.mget.firstCall.args[0]).to.deep.equal(['device:foo1','device:foo2']);
                });
                done()

            }).catch(err => {
                done(err)
            })
        })

        it('getDeviceIds (no devices)', function(done) {
            let dbsvc = {
                name: 'db',
                init: sinon.stub().yields(),
                query: sinon.fake.resolves({
                    rows: []
                })
            }
            let eventsvc = {
                name: 'event',
                init: sinon.stub().yields(),
                getInstance: sinon.fake.returns({
                    addListener: sinon.fake(),
                    subscribe: sinon.fake()
                }),
                subscribe: sinon.fake()
            }
            let logsvc = {
                name: 'log',
                init: sinon.stub().yields()
            }
            registerService(dbsvc)
            registerService(logsvc)
            registerService(eventsvc)
            
            const redisMock = {
                keys: sinon.stub().resolves([]),
                mget: sinon.stub().resolves([])
            };
            StorageService.prototype._buildRedisClient = sinon.fake.returns(redisMock)
            
            let ss = new StorageService()
            registerService(ss).then(svc => {
                ss.getDeviceIds().then(data => {
                    expect(data).to.deep.equal([]);
                    
                    expect(redisMock.keys.callCount).to.equal(1);
                    expect(redisMock.keys.firstCall.args[0]).to.equal('device:*');
                });
                done()

            }).catch(err => {
                done(err)
            })
        })

        it('getDeviceIds (1 device)', function(done) {
            let dbsvc = {
                name: 'db',
                init: sinon.stub().yields(),
                query: sinon.fake.resolves({
                    rows: []
                })
            }
            let eventsvc = {
                name: 'event',
                init: sinon.stub().yields(),
                getInstance: sinon.fake.returns({
                    addListener: sinon.fake(),
                    subscribe: sinon.fake()
                }),
                subscribe: sinon.fake()
            }
            let logsvc = {
                name: 'log',
                init: sinon.stub().yields()
            }
            registerService(dbsvc)
            registerService(logsvc)
            registerService(eventsvc)
            
            const redisMock = {
                keys: sinon.stub().resolves(['device:foo'])
            };
            StorageService.prototype._buildRedisClient = sinon.fake.returns(redisMock)
            
            let ss = new StorageService()
            registerService(ss).then(svc => {
                ss.getDeviceIds().then(data => {
                    expect(data).to.deep.equal(['foo']);
                    
                    expect(redisMock.keys.callCount).to.equal(1);
                    expect(redisMock.keys.firstCall.args[0]).to.equal('device:*');
                });
                done()

            }).catch(err => {
                done(err)
            })
        })

        it('getDeviceIds (2 devices)', function(done) {
            let dbsvc = {
                name: 'db',
                init: sinon.stub().yields(),
                query: sinon.fake.resolves({
                    rows: []
                })
            }
            let eventsvc = {
                name: 'event',
                init: sinon.stub().yields(),
                getInstance: sinon.fake.returns({
                    addListener: sinon.fake(),
                    subscribe: sinon.fake()
                }),
                subscribe: sinon.fake()
            }
            let logsvc = {
                name: 'log',
                init: sinon.stub().yields()
            }
            registerService(dbsvc)
            registerService(logsvc)
            registerService(eventsvc)
            
            const redisMock = {
                keys: sinon.stub().resolves(['device:foo1','device:foo2'])
            };
            StorageService.prototype._buildRedisClient = sinon.fake.returns(redisMock)
            
            let ss = new StorageService()
            registerService(ss).then(svc => {
                ss.getDeviceIds().then(data => {
                    expect(data).to.deep.equal(['foo1','foo2']);
                    
                    expect(redisMock.keys.callCount).to.equal(1);
                    expect(redisMock.keys.firstCall.args[0]).to.equal('device:*');
                });
                done()

            }).catch(err => {
                done(err)
            })
        })

        it('getDeviceById (no devices found)', function(done) {
            let dbsvc = {
                name: 'db',
                init: sinon.stub().yields(),
                query: sinon.fake.resolves({
                    rows: []
                })
            }
            let eventsvc = {
                name: 'event',
                init: sinon.stub().yields(),
                getInstance: sinon.fake.returns({
                    addListener: sinon.fake(),
                    subscribe: sinon.fake()
                }),
                subscribe: sinon.fake()
            }
            let logsvc = {
                name: 'log',
                init: sinon.stub().yields()
            }
            registerService(dbsvc)
            registerService(logsvc)
            registerService(eventsvc)
            
            const redisMock = {
                get: sinon.stub().resolves(undefined)
            };
            StorageService.prototype._buildRedisClient = sinon.fake.returns(redisMock)
            
            let ss = new StorageService()
            registerService(ss).then(svc => {
                ss.getDeviceById('foo').then(data => {
                    expect(data).to.be.undefined
                    
                    expect(redisMock.get.callCount).to.equal(1);
                    expect(redisMock.get.firstCall.args[0]).to.equal('device:foo');
                });
                done()

            }).catch(err => {
                done(err)
            })
        })

        it('getDeviceById (device found)', function(done) {
            let dbsvc = {
                name: 'db',
                init: sinon.stub().yields(),
                query: sinon.fake.resolves({
                    rows: []
                })
            }
            let eventsvc = {
                name: 'event',
                init: sinon.stub().yields(),
                getInstance: sinon.fake.returns({
                    addListener: sinon.fake(),
                    subscribe: sinon.fake()
                }),
                subscribe: sinon.fake()
            }
            let logsvc = {
                name: 'log',
                init: sinon.stub().yields()
            }
            registerService(dbsvc)
            registerService(logsvc)
            registerService(eventsvc)
            
            const redisMock = {
                get: sinon.stub().resolves(JSON.stringify({'deviceId': 'foo'}))
            };
            StorageService.prototype._buildRedisClient = sinon.fake.returns(redisMock)
            
            let ss = new StorageService()
            registerService(ss).then(svc => {
                ss.getDeviceById('foo').then(data => {
                    expect(data).to.deep.equal({'deviceId': 'foo'})
                    
                    expect(redisMock.get.callCount).to.equal(1);
                    expect(redisMock.get.firstCall.args[0]).to.equal('device:foo');
                });
                done()

            }).catch(err => {
                done(err)
            })
        })
    })

    

    describe('augmented sensor event tests', function() {
        it('should update sensor dt and value on event', function(done) {
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
            
            const redisMock = {
                get: sinon.stub().resolves(JSON.stringify({'sensorId': 'id1'})),
                setex: sinon.stub().resolves({'sensorId': 'id1', 'sensorValue': 123, 'sensorDt': new Date()})
            };
            StorageService.prototype._buildRedisClient = sinon.fake.returns(redisMock);
            let ss = new StorageService();

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

                    // wait for promise
                    global.setTimeout(() => {
                        try {
                            expect(redisMock.get.callCount).to.be.equal(1);
                            expect(redisMock.get.firstCall.args[0]).to.be.equal('sensor:id1');
                            
                            expect(redisMock.setex.callCount).to.be.equal(1);
                            expect(redisMock.setex.firstCall.args[0]).to.be.equal('sensor:id1');
                            expect(redisMock.setex.firstCall.args[1]).to.be.equal(600);
                            let o = JSON.parse(redisMock.setex.firstCall.args[2]);
                            
                            expect(o).to.have.keys('sensorId','sensorValue','sensorDt');
                            expect(o.sensorId).be.equal('id1');
                            expect(o.sensorValue).be.equal(123);
                            expect(o.sensorDt).to.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
                            done()
    
                        } catch (err) {
                            done(err);
                        }
                    }, 500)
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

            const redisMock = {
                get: sinon.stub().resolves(JSON.stringify({'deviceId': 'id1', 'restarts': 2})),
                setex: sinon.stub().resolves()
            };
            StorageService.prototype._buildRedisClient = sinon.fake.returns(redisMock);
            let ss = new StorageService();

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

                    global.setTimeout(() => {
                        try {
                            expect(redisMock.setex.firstCall.args[0]).to.be.equal('device:id1');
                            let o = JSON.parse(redisMock.setex.firstCall.args[2]);
                            expect(o.deviceId).to.be.equal('id1');
                            expect(o.restarts).to.be.equal(3);

                            done()
                        } catch(err) {
                            done(err)
                        }
                    }, 500)
                }
            }
            registerService(eventsvc)

            registerService(ss).then(svcs => {
                eventsvc.publish({
                    'deviceId': 'id1',
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
            
            const redisMock = {
                get: sinon.stub().resolves(undefined),
                setex: sinon.stub().resolves()
            };
            StorageService.prototype._buildRedisClient = sinon.fake.returns(redisMock);
            let ss = new StorageService();

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

                    global.setTimeout(() =>{
                        try {
                            // device creation in redis
                            expect(redisMock.setex.firstCall.args[0]).to.be.equal('device:unknownid1');

                            // update device
                            expect(redisMock.setex.secondCall.args[0]).to.be.equal('device:unknownid1');
                            let o = JSON.parse(redisMock.setex.secondCall.args[2]);
                            expect(o.deviceId).to.be.equal('unknownid1');
                            expect(o.restarts).to.be.equal(1);

                            done();
                        } catch (err) {
                            done(err);
                        }
                    })
                    
                }
            }
            registerService(eventsvc)

            registerService(ss).then(svcs => {
                eventsvc.publish({
                    'deviceId': 'unknownid1',
                    'restart': true
                })
            })
        })

        it('should update watchdog reset count on control nessage with restart=true (known device)', function(done) {
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
            
            const redisMock = {
                get: sinon.stub().resolves(JSON.stringify({'deviceId': 'knownid1', 'watchdogResets': 14})),
                setex: sinon.stub().resolves()
            };
            StorageService.prototype._buildRedisClient = sinon.fake.returns(redisMock);
            let ss = new StorageService();


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

                    global.setTimeout(() => {
                        try {
                            expect(redisMock.get.firstCall.args[0]).to.be.equal('device:knownid1');

                            expect(redisMock.setex.firstCall.args[0]).to.be.equal('device:knownid1');
                            let o = JSON.parse(redisMock.setex.firstCall.args[2]);
                            expect(o.deviceId).to.be.equal('knownid1');
                            expect(o.watchdogResets).to.be.equal(15);

                            done();
                        } catch (err) {
                            done(err);
                        }
                    })
                }
            }
            registerService(eventsvc)

            registerService(ss).then(svcs => {
                eventsvc.publish({
                    'deviceId': 'knownid1',
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
            
            const redisMock = {
                get: sinon.stub().resolves(undefined),
                setex: sinon.stub().resolves()
            };
            StorageService.prototype._buildRedisClient = sinon.fake.returns(redisMock);
            let ss = new StorageService();

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

                    global.setTimeout(() => {
                        try {
                            expect(redisMock.get.firstCall.args[0]).to.be.equal('device:unknownid2');

                            // device creation in redis
                            expect(redisMock.setex.firstCall.args[0]).to.be.equal('device:unknownid2');

                            // update device in redis
                            expect(redisMock.setex.secondCall.args[0]).to.be.equal('device:unknownid2');
                            let o = JSON.parse(redisMock.setex.secondCall.args[2]);
                            expect(o.deviceId).to.be.equal('unknownid2');
                            expect(o.restarts).to.be.equal(0);
                            expect(o.watchdogResets).to.be.equal(1);
                            done();

                        } catch (err) {
                            done(err);
                        }
                    })
                }
            }
            registerService(eventsvc)

            registerService(ss).then(svcs => {
                eventsvc.publish({
                    'deviceId': 'unknownid2',
                    'watchdogReset': true
                })
            })
        })
    })
})

