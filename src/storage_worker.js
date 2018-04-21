const {Pool} = require('pg')
const PubNub = require('pubnub')
const terminateListener = require('./terminate-listener.js')
const constants = require('./constants.js')

// connect to db using pool
const pool = new Pool({
  'connectionString': process.env.DATABASE_URL,
  'ssl': true
})

// pubscribe to channel
const pubnub = new PubNub({
    'subscribeKey': process.env.PUBNUB_SUBSCRIBE_KEY,
    'publishKey': process.env.PUBNUB_PUBLISH_KEY,
    'ssl': true
})
pubnub.addListener({
    'message': (msg) => {
        const channelName = msg.channel
        const obj = msg.message
        console.log(`Received message on ${channelName} channel with payload ${JSON.stringify(obj)}`)

        // insert into db
        pool.query(`insert into sensor_data (dt, id, value) values (current_timestamp, '${obj.sensorId}', ${obj.sensorValue});`);
        console.log(`db - did INSERT of ${obj.sensorValue} for ${obj.sensorId}`)

        // send new event with more data
        global.setImmediate(() => {
            pool.query("select s.id sensorId, s.name sensorName, d.name deviceName, d.id deviceId from sensor s left outer join device d on d.id=s.deviceId  where s.id=$1", [obj.sensorId]).then(rs => {
                let row = rs.rows[0]
                let msg = {
                    'sensorName': row.sensorname,
                    'sensorId': row.sensorid,
                    'sensorValue': obj.sensorValue,
                    'deviceName': row.devicename,
                    'deviceId': row.deviceid
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

// setup termination listener
terminateListener(() => {
    console.log("Closing postgres driver");
    pool.end()
    console.log("Closed postgres driver");
    console.log("Unsubscribing from PubNub");
    pubnub.unsubscribeAll()
    console.log("Unsubscribed from PubNub");
  });
  