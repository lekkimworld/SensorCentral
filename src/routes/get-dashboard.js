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
      let data = Object.values(svc.getInstance()).reduce((prev, sensor) => {
        let m = (sensor.sensorDt) ? moment(sensor.sensorDt) : undefined
        let strdate = m ? formatDate(m) : 'aldrig'
        let mins = m ? moment().diff(m, 'minutes') : -1
        const sensorType = !sensor.sensorType ? constants.SENSOR_TYPES.UNKNOWN : Object.keys(constants.SENSOR_TYPES).map(k => constants.SENSOR_TYPES[k]).reduce((prev, obj) => {
          if (prev) return prev
          if (obj.type === sensor.sensorType) return obj
        }, undefined)
        const value = `${sensor.sensorValue.toFixed(2)}${sensorType.denominator}`
        const name = `${sensor.sensorName ? sensor.sensorName : 'NN'} (${sensor.deviceName ? sensor.deviceName : 'NN'})`
        let result = {
          'value': value,
          'name': name,
          'dt': strdate,
          'last': mins,
          'raw': {
            "sensor": {
              'id': sensor.sensorId,
              'value': sensor.sensorValue,
              'denominator': sensorType.donominator,
              'name': sensor.sensorName,
              'type': sensorType.type,
            },
            "device": {
              "id": sensor.deviceId,
              "name": sensor.deviceName
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
      res.status(500).send('Required service not available').end()
    })
})

module.exports = router
