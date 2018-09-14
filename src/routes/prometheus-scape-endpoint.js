const express = require('express')
const router = express.Router()
const srvc = require('../configure-services.js')
const constants = require('../constants.js')

// create storage for last received events
const storage = {}

// listen to pubnub channel for events and keep last event data around for each sensor
const pubnub = srvc.events.getInstance(true)
pubnub.addListener({
    'message': (msg) => {
        const channelName = msg.channel
        const obj = msg.message
        console.log(`Received message on ${channelName} channel with payload ${JSON.stringify(obj)}`)

        // put in storage
        storage[obj.sensorId] = obj
    }
})
pubnub.subscribe({
    channels: [constants.PUBNUB.AUG_CHANNEL_NAME]
})

router.get('/scrapedata', (req, res) => {
    res.set({
        'Content-Type': 'text/plain'
    })
    res.send(Object.keys(storage).map(key => storage[key]).reduce((buffer, obj) => {
        buffer += `${obj.sensorId} ${obj.sensorValue}\n`
        if (obj.sensorName) {
            buffer += `${obj.sensorName} ${obj.sensorValue}\n`
        }
        if (obj.deviceName && obj.sensorName) {
            buffer += `${obj.deviceName}-${obj.sensorName} ${obj.sensorValue}\n`
        }
        return prev
    }, '')).end()
})

module.exports = router
