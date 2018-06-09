const express = require('express')
const router = express.Router()
const srvc = require('../configure-services.js')
const constants = require('../constants.js')

// max temp to register
const MIN_REGISTER_TEMP = process.env.MIN_REGISTER_TEMP || constants.SENSOR_VALUES.MIN_REGISTER_TEMP

// get pubnub instance configured for publishing
const pubnub = srvc.events.getInstance(true)

router.post('/*', (req, res) => {
    // see if array
    let data = req.body
    if (typeof data === 'object' && Object.keys(data).length === 0) {
      return res.status(417).end()
    }
    // wrap in array if not an array
    if (!Array.isArray(data)) {
      data = [data]
    }
    data.forEach(element => {
      // sanity
      if (element.sensorValue < MIN_REGISTER_TEMP) {
        console.log(`Ignoring value of ${element.sensorValue} from ${element.sensorId} as value to is too low (< ${MIN_REGISTER_TEMP})`)
        return
      }
  
      // post message about sensor reading
      pubnub.publish({
        'message': {
          'sensorValue': element.sensorValue,
          'sensorId': element.sensorId
        },
        'channel': constants.PUBNUB.RAW_CHANNEL_NAME
      }).then(resp => {
        console.log(`SUCCESS - posted value of ${element.sensorValue} from ${element.sensorId} as value to channel ${constants.PUBNUB.RAW_CHANNEL_NAME}`)
      }).catch(err => {
        console.log(`ERROR -  could NOT post value of ${element.sensorValue} from ${element.sensorId} as value to channel ${constants.PUBNUB.RAW_CHANNEL_NAME}`)
        console.log(err)
      })
    });
  
    // acknowledge post
    let j = JSON.stringify(data, undefined, 2)
    console.log(`Received: ${j}`)
    res.setHeader('Content-Type', 'text/plain')
    res.send(`Thank you - you posted: ${j}\n`).end()
})

module.exports = router
