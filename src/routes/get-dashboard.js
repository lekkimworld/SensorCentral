const express = require('express')
const router = express.Router()
const constants = require('../constants.js')
const moment = require('moment-timezone')
const srvc = require('../configure-services.js')

router.get('/dashboard', (req, res) => {
    const formatDate = (date) => {
      let m = date && date['diff'] ? date : date ? moment(date) : moment()
      return m.tz('Europe/Copenhagen').format("D-M-YYYY [kl.] k:mm")
    }
    
    srvc.lookupService('storage').then(svc => {
		let data = svc.getSensorIds().reduce((prev, sensorId) => {
			// ignore sensors with no reading
			let sensor = svc.getSensorById(sensorId)
			if (undefined === sensor.sensorValue || sensor.sensorValue === Number.MIN_VALUE) return prev

			// format date/time value was read
			let m = (sensor.sensorDt) ? moment(sensor.sensorDt) : undefined
			let strdate = m ? formatDate(m) : 'aldrig'
			let mins = m ? moment().diff(m, 'minutes') : -1
			let sensorType = !sensor.sensorType ? constants.SENSOR_TYPES.UNKNOWN : Object.keys(constants.SENSOR_TYPES).map(k => constants.SENSOR_TYPES[k]).reduce((prev, obj) => {
				if (prev) return prev
				if (obj.type === sensor.sensorType) return obj
			}, undefined)
			const value = `${sensor.sensorValue.toFixed(2)}${sensorType.denominator}`
			const name = `${sensor.sensorName ? sensor.sensorName : 'NN'} (${sensor.device.deviceName ? sensor.device.deviceName : 'NN'})`
			let result = {
				'value': value,
				'name': name,
				'dt': strdate,
				'last': mins,
				'raw': {
					"sensor": {
						'id': sensor.sensorId,
						'value': sensor.sensorValue,
						'name': sensor.sensorName,
						'label': sensor.sensorLabel,
						'denominator': sensorType.denominator,
						'type': sensorType.type,
					},
					"device": {
						"id": sensor.device.deviceId,
						"name": sensor.device.deviceName
					}
				}
			}
			prev.push(result)
			return prev
		}, [])

		// build result object for templte
		let context = {'updated': formatDate()}
		context.data = data
		res.render('dashboard', context)

    }).catch(err => {
    	res.status(500).send('Required storage-service not available').end()
    })
})

module.exports = router
