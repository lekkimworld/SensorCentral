const {lookupService} = require('./configure-services.js')
const constants = require('./constants.js')
const Pushover = require('node-pushover')
const moment = require('moment-timezone')

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
                lookupService('db').then(dbSvc => {
                    dbSvc.query(`insert into sensor_data (dt, id, value) values (current_timestamp, '${obj.sensorId}', ${obj.sensorValue});`);
                    console.log(`db - did INSERT of ${obj.sensorValue} for ${obj.sensorId}`)

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
                                'channel': constants.PUBNUB.AUG_CHANNEL_NAME
                            })
                        })
                    })
                })
            }
        })
        pubnub.subscribe({
            channels: [constants.PUBNUB.RAW_CHANNEL_NAME]
        })
    })
}

/**
 * Log raw event data.
 */
const logRawEventData = () => {
    // get instance
    lookupService('event').then(svc => {
        const pubnub = svc.getInstance()

        // subcribe to channel
        pubnub.addListener({
            'message': (msg) => {
                const channelName = msg.channel
                const obj = msg.message
                console.log(`Log raw messages received message on ${channelName} channel with payload ${JSON.stringify(obj)}`)

            }
        })
        pubnub.subscribe({
            channels: [constants.PUBNUB.RAW_CHANNEL_NAME]
        })
    })
}

/**
 * Log enriched event data.
 */
const logEnrichedEventEventData = () => {
    // get instance
    lookupService('event').then(svc => {
        const pubnub = svc.getInstance()

        // subcribe to channel
        pubnub.addListener({
            'message': (msg) => {
                const channelName = msg.channel
                const obj = msg.message
                console.log(`Log augmented messages received message on ${channelName} channel with payload ${JSON.stringify(obj)}`)
            }
        })
        pubnub.subscribe({
            channels: [constants.PUBNUB.AUG_CHANNEL_NAME]
        })
    })
}

/**
 * Send event to pushover if freezing tempeture outside.
 */
const postToPushoverIfFreezing = () => {
    // get pushover data
    const PUSHOVER_APPTOKEN = process.env.PUSHOVER_APPTOKEN
    const PUSHOVER_USERKEY = process.env.PUSHOVER_USERKEY
    const pushover = (function() {
    if (PUSHOVER_USERKEY && PUSHOVER_APPTOKEN) {
        return new Pushover({
            token: PUSHOVER_APPTOKEN,
            user: PUSHOVER_USERKEY
        })
    }
    })()

    if (!pushover) {
        // nothing to do here
        console.log('Pushover support not configured - exiting...')
        return
    }

    // get instance
    lookupService('event').then(svc => {
        const pubnub = svc.getInstance(false)

        // subcribe to channel
        let pushoverLastSent = undefined
        pubnub.addListener({
            'message': (msg) => {
                const channelName = msg.channel
                const obj = msg.message

                if (obj.sensorId === '28FF46C76017059A' && obj.sensorValue < 0 && (!pushoverLastSent || moment().diff(pushoverLastSent, 'minutes') > 60)) {
                    pushoverLastSent = moment()
                    pushover.send('Frostvejr', `Det er frostvejr... (${obj.sensorValue})`)
                }
            }
        })
        pubnub.subscribe({
            channels: [constants.PUBNUB.RAW_CHANNEL_NAME]
        })
    })
}

module.exports = () => {
    logRawEventData()
    logEnrichedEventEventData()
    insertDataFromRawEventAndPublishEnrichedEvent()
    postToPushoverIfFreezing();
}
