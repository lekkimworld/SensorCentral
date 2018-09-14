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
        let fixedName = obj.sensorLabel ? obj.sensorName : `nolabel${obj.sensorId}`
        let deviceId = obj.deviceId ? obj.deviceId : 'unknown'
        let deviceName = obj.deviceName ? obj.deviceName : 'unknown'
        buffer += `sensor_${fixedName}\{sensorId="${obj.sensorId}",deviceId="${deviceId}",deviceName="${deviceName}"\} ${obj.sensorValue}\n`
        return buffer
    }, '')).end()
})

module.exports = router
