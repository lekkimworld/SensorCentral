const {lookupService} = require('./configure-services.js')
const constants = require('./constants.js')

/**
 * Suscribe to the raw channel for event data - then insert data in database and 
 * published enriched data event with more info on the sensor from the db.
 * 
 */
const insertDataFromRawEventAndPublishEnrichedEvent = () => {
    // get instance
    lookupService('event').then(eventSvc => {
        eventSvc.getQueue(constants.QUEUES.RAW_SENSORREADING_CHANNEL).subscribe((obj, callback) => {
            // insert into db
            lookupService(['log','db']).then(services => {
                const logSvc = services[0];
                const dbSvc = services[1];
                dbSvc.query(`insert into sensor_data (dt, id, value) values (current_timestamp, '${obj.sensorId}', ${obj.sensorValue});`);
                logSvc.debug(`db - did INSERT of ${obj.sensorValue} for ${obj.sensorId}`)

                // send new event with more data
                global.setImmediate(() => {
                    let msg = {
                        'sensorName': null,
                        'sensorLabel': null,
                        'sensorId': obj.sensorId,
                        'sensorValue': obj.sensorValue,
                        'deviceName': null,
                        'deviceId': null
                    }
                    dbSvc.query("select s.id sensorId, s.name sensorName, s.label sensorLabel, d.name deviceName, d.id deviceId from sensor s left outer join device d on d.id=s.deviceId where s.id=$1", obj.sensorId).then(rs => {
                        let row = rs.rows[0]
                        if (row) {
                            msg.sensorName = row.sensorname
                            msg.sensorLabel = row.sensorlabel
                            msg.deviceName = row.devicename
                            msg.deviceId = row.deviceid
                        }
                        eventSvc.getQueue(constants.QUEUES.AUG_SENSOR_CHANNEL).publish(msg)

                        // acknowledge queue messahe
                        callback();
                    })
                })
            })
        })
    })
}

module.exports = () => {
    
}
