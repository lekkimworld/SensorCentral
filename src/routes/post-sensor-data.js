const express = require('express')
const router = express.Router()
const services = require('../configure-services.js')
const constants = require('../constants.js')

// max temp to register
const MIN_REGISTER_TEMP = process.env.MIN_REGISTER_TEMP || constants.SENSOR_VALUES.MIN_REGISTER_TEMP

router.post('/*', (req, res) => {
    // get data and see if array
	const body = req.body
	const dataObj = (function()  {
		if (Array.isArray(body)) {
			// received old data format
			return {
				'msgtype': 'data',
				'data': body
			}
		} else if (!('msgtype' in body)) {
			// it's an object but without msgtype
			return {
				'msgtype': 'data',
				'data': [body]
			}
		} else {
			// received new data format
			return body
		}
	})()
    	
	// validate msgtype
	const msgtype = dataObj.msgtype
	if (!['control', 'data'].includes(msgtype)) {
		// invalid message type
		return res.status(417).send(`Invalid msgtype <${msgtype}> received`).end()
	}

    // lookup event service to publish event
    services.lookupService('event').then(svc => {
		// get pubnub instance configured for publishing
		const pubnub = svc.getInstance(true)

		if (msgtype === 'control') {
			// control
			pubnub.publish({
				'message': dataObj.data,
				'channel': constants.PUBNUB.CTRL_CHANNEL_NAME
			}).then(resp => {
				console.log(`SUCCESS - posted control message (<${JSON.stringify(dataObj.data)}>) to channel <${constants.PUBNUB.CTRL_CHANNEL_NAME}>`)
			}).catch(err => {
				console.log(`ERROR - could NOT post control message (<${JSON.stringify(dataObj.data)}>) to channel <${constants.PUBNUB.CTRL_CHANNEL_NAME}>`)
				console.log(err)
			})
		} else {
			// data
			dataObj.data.forEach(element => {
				// sanity
				if (element.sensorValue < MIN_REGISTER_TEMP) {
					console.log(`Ignoring value of <${element.sensorValue}> from <${element.sensorId}> as value to is too low (<${MIN_REGISTER_TEMP}>)`)
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
					console.log(`SUCCESS - posted value of <${element.sensorValue}> from <${element.sensorId}> as value to channel <${constants.PUBNUB.RAW_CHANNEL_NAME}>`)
				}).catch(err => {
					console.log(`ERROR - could NOT post value of <${element.sensorValue}> from <${element.sensorId}> as value to channel <${constants.PUBNUB.RAW_CHANNEL_NAME}>`)
					console.log(err)
				})
			})
		}
    })
  
    // acknowledge post
    let j = JSON.stringify(data, undefined, 2)
    console.log(`Received: ${j}`)
    res.setHeader('Content-Type', 'text/plain')
    res.send(`Thank you - you posted: ${j}\n`).end()
})

module.exports = router
