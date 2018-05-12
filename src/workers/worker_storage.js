const srvc = require('../configure-services.js')
const terminateListener = require('../terminate-listener.js')
const constants = require('../constants.js')

// pubscribe to channel
const pubnub = srvc.events.getInstance(true)
pubnub.addListener({
    'message': (msg) => {
        const channelName = msg.channel
        const obj = msg.message
        console.log(`Received message on ${channelName} channel with payload ${JSON.stringify(obj)}`)

        // insert into db
        srvc.db.query(`insert into sensor_data (dt, id, value) values (current_timestamp, '${obj.sensorId}', ${obj.sensorValue});`);
        console.log(`db - did INSERT of ${obj.sensorValue} for ${obj.sensorId}`)

        // send new event with more data
        global.setImmediate(() => {
            let msg = {
                'sensorName': null,
                'sensorId': obj.sensorId,
                'sensorValue': obj.sensorValue,
                'deviceName': null,
                'deviceId': null
            }
            srvc.db.query("select s.id sensorId, s.name sensorName, d.name deviceName, d.id deviceId from sensor s left outer join device d on d.id=s.deviceId where s.id=$1", obj.sensorId).then(rs => {
                let row = rs.rows[0]
                if (row) {
                    msg.sensorName = row.sensorname
                    msg.deviceName = row.devicename
                    msg.deviceId = row.deviceid
                }
                pubnub.publish({
                    'message': msg,
                    'channel': constants.PUBNUB.AUG_CHANNEL_NAME
                })
            })
        })
    }
})
pubnub.subscribe({
    channels: [constants.PUBNUB.RAW_CHANNEL_NAME]
})
