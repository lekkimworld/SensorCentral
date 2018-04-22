const Pushover = require('node-pushover')
const moment = require('moment-timezone')
const constants = require('../constants.js')
const srvc = require('../configure-services.js')

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
    process.exit(0)
}

// subcribe to channel
const pubnub = srvc.events.getInstance()
let pushoverLastSent = undefined
pubnub.addListener({
    'message': (msg) => {
        const channelName = msg.channel
        const obj = msg.message
        console.log(`Received message on ${channelName} channel with payload ${JSON.stringify(obj)}`)

        if (obj.sensorId === '28FF46C76017059A' && obj.sensorValue < 0 && (!pushoverLastSent || moment().diff(pushoverLastSent, 'minutes') > 60)) {
            pushoverLastSent = moment()
            pushover.send('Frostvejr', `Det er frostvejr... (${obj.sensorValue})`)
        }
    }
})
pubnub.subscribe({
    channels: [constants.PUBNUB.RAW_CHANNEL_NAME]
})
