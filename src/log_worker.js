const PubNub = require('pubnub')
const terminateListener = require('./terminate-listener.js')
const constants = require('./constants.js')

// subcribe to channel
const pubnub = new PubNub({
    'subscribeKey': process.env.PUBNUB_SUBSCRIBE_KEY,
    'ssl': true
})
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

// setup termination listener
terminateListener(() => {
    console.log("Unsubscribing from PubNub");
    pubnub.unsubscribeAll()
    console.log("Unsubscribed from PubNub");
  });
  