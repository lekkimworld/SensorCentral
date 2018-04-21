const {Pool, Client} = require('pg')
const Pushover = require('node-pushover')
const PubNub = require('pubnub')
const terminateListener = require('./terminate-listener.js')
const constants = require('./constants.js')

// connect to db using pool
const connectionString = process.env.DATABASE_URL
const pool = new Pool({
  'connectionString': connectionString
})

// get pushover data
const PUSHOVER_APPTOKEN = process.env.PUSHOVER_APPTOKEN
const PUSHOVER_USERKEY = process.env.PUSHOVER_USERKEY
let pushoverLastSent = undefined
const pushover = (function() {
  if (PUSHOVER_USERKEY && PUSHOVER_APPTOKEN) {
    return new Pushover({
        token: PUSHOVER_APPTOKEN,
        user: PUSHOVER_USERKEY
    })
  }
})()

// pubscribe to channel
const pubnub = new PubNub({
    'subscribeKey': process.env.PUBNUB_SUBSCRIBE_KEY,
    'ssl': true
})
pubnub.addListener({
    'message': (msg) => {
        const channelName = msg.channel
        const obj = msg.message
        console.log(`Received message on ${channelName} channel with payload ${JSON.stringify(obj)}`)

        // insert into db
        pool.query(`insert into sensor_data (dt, id, value) values (current_timestamp, '${obj.sensorId}', ${obj.sensorValue});`);        
    }
})
pubnub.subscribe({
    channels: [constants.PUBNUB.CHANNEL_NAME]
})




if (pushover && element.sensorId === '28FF46C76017059A' && element.sensorValue < 0 && (!pushoverLastSent || moment().diff(pushoverLastSent, 'minutes') > 60)) {
  pushoverLastSent = moment()
  pushover.send('Frostvejr', `Det er frostvejr... (${element.sensorValue})`)
}


// setup termination listener
terminateListener(() => {
    console.log("Closing postgres driver");
    pool.end()
    console.log("Closed postgres driver");
    console.log("Unsubscribing from PubNub");
    pubnub.unsubscribeAll()
    console.log("Unsubscribed from PubNub");
  });
  