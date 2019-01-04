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
		if (!body) {
			return undefined
		}
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
	
	// validate input
	if (!dataObj) {
		res.set({
			'Content-Type': 'text/plain'
		})
		return res.status(417).send(`Expected to receive body data`).end()
	}

	// validate msgtype
	const msgtype = dataObj.msgtype
	if (!['control', 'data'].includes(msgtype)) {
		// invalid message type
		return res.set({
			'Content-Type': 'text/plain'
		}).status(417).send(`Invalid msgtype <${msgtype}> received`).end()
	}

    // lookup event service to publish event
    services.lookupService(['log', 'event']).then((svcs) => {
		// get services
		const logSvc = svcs[0]
		const eventSvc = svcs[1]

		// acknowledge post
		let j = JSON.stringify(dataObj, undefined, 2)
		logSvc.info(`Received: ${j}`)
		res.set('Content-Type', 'text/plain').send(`Thank you - you posted: ${j}\n`).end()
		
		// get pubnub instance configured for publishing
		const pubnub = eventSvc.getInstance(true)

		if (msgtype === 'control') {
			// control
			pubnub.publish({
				'message': dataObj.data,
				'channel': constants.PUBNUB.CTRL_CHANNEL
			}).then(resp => {
				console.log(`SUCCESS - posted control message (<${JSON.stringify(dataObj.data)}>) to channel <${constants.PUBNUB.CTRL_CHANNEL}>`)
			}).catch(err => {
				console.log(`ERROR - could NOT post control message (<${JSON.stringify(dataObj.data)}>) to channel <${constants.PUBNUB.CTRL_CHANNEL}>`)
				console.log(err)
			})
		} else if (msgtype === 'data') {
			// data - get device id
			const deviceId = dataObj.deviceId
			if (deviceId) {
				// device id supplied - publish a device event
				dataObj.deviceId = dataObj.deviceId.toUpperCase()
				pubnub.publish({
					'message': dataObj,
					'channel': constants.PUBNUB.RAW_DEVICEREADING_CHANNEL
				}).then(() => {

				}).catch(err => {

				})
			}

			// send a raw event per data element
			dataObj.data.filter(element => element.sensorId && element.sensorValue).forEach(element => {
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
					'channel': constants.PUBNUB.RAW_SENSORREADING_CHANNEL
				}).then(resp => {
					console.log(`SUCCESS - posted value of <${element.sensorValue}> from <${element.sensorId}> as value to channel <${constants.PUBNUB.RAW_SENSORREADING_CHANNEL}>`)
				}).catch(err => {
					console.log(`ERROR - could NOT post value of <${element.sensorValue}> from <${element.sensorId}> as value to channel <${constants.PUBNUB.RAW_SENSORREADING_CHANNEL}>`)
					console.log(err)
				})
			})
		}
    }).catch(err => {
		return res.set('Content-Type', 'text/plain; charset=utf-8').status(500).send('Unable to find event bus').end()
	})
})

module.exports = router
