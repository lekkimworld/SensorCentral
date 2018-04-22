const srvc = require('../configure-services.js')
const constants = require('../constants.js')

// subcribe to channel
const pubnub = srvc.events.getInstance()
pubnub.addListener({
    'message': (msg) => {
        const channelName = msg.channel
        const obj = msg.message
        console.log(`Received message on ${channelName} channel with payload ${JSON.stringify(obj)}`)

    }
})
pubnub.subscribe({
    channels: [constants.PUBNUB.AUG_CHANNEL_NAME]
})


  