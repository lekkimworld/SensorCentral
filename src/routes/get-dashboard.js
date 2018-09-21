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
        let m = moment(sensor.sensorDt)
        let strdate = formatDate(m)
        let mins = moment().diff(m, 'minutes')
        const sensorType = !sensor.sensorType ? constants.SENSOR_TYPES.UNKNOWN : Object.keys(constants.SENSOR_TYPES).map(k => constants.SENSOR_TYPES[k]).reduce((prev, obj) => {
          if (prev) return prev
          if (obj.type === sensor.sensorType) return obj
        }, undefined)
        const value = `${sensor.sensorValue}${sensortype.denominator}`
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
        return result
      }, [])

      // build result object for templte
      let context = {'updated': formatDate()}
      context.data = data
      res.render('dashboard', context)

    }).catch(err => {
      console.log(err)  
    })
})

module.exports = router
