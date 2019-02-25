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
        const pubnub = eventSvc.getInstance(true)

        pubnub.addListener({
            'message': (msg) => {
                const channelName = msg.channel
                const obj = msg.message
                
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
                            pubnub.publish({
                                'message': msg,
                                'channel': constants.PUBNUB.AUG_CHANNEL
                            })
                        })
                    })
                })
            }
        })
        pubnub.subscribe({
            channels: [constants.PUBNUB.RAW_SENSORREADING_CHANNEL]
        })
    })
}

/**
 * Log raw event data.
 */
const logRawEventData = () => {
    // get instance
    lookupService(['log','event']).then(services => {
        const logSvc = services[0];
        const eventSvc = services[1];
        const pubnub = eventSvc.getInstance()

        // subcribe to channel
        pubnub.addListener({
            'message': (msg) => {
                const channelName = msg.channel
                const obj = msg.message
                logSvc.debug(`Log raw messages received message on ${channelName} channel with payload ${JSON.stringify(obj)}`)

            }
        })
        pubnub.subscribe({
            channels: [constants.PUBNUB.RAW_SENSORREADING_CHANNEL]
        })
    })
}

/**
 * Log enriched event data.
 */
const logEnrichedEventEventData = () => {
    // get instance
    lookupService(['log','event']).then(services => {
        const logSvc = services[0];
        const eventSvc = services[1];
        const pubnub = eventSvc.getInstance()

        // subsribe to channel
        pubnub.addListener({
            'message': (msg) => {
                const channelName = msg.channel
                const obj = msg.message
                logSvc.debug(`Log augmented messages received message on ${channelName} channel with payload ${JSON.stringify(obj)}`)
            }
        })
        pubnub.subscribe({
            channels: [constants.PUBNUB.AUG_CHANNEL, constants.PUBNUB.RAW_DEVICEREADING_CHANNEL]
        })
    })
}

module.exports = () => {
    logRawEventData()
    logEnrichedEventEventData()
    insertDataFromRawEventAndPublishEnrichedEvent()
}
