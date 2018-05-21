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
    const parse = (rows) => {
      return rows.map(row => {
        let m = moment(row.dt)
        let strdate = formatDate(m)
        let mins = moment().diff(m, 'minutes')
        const sensortype = !row.sensortype ? constants.SENSOR_TYPES.UNKNOWN : Object.keys(constants.SENSOR_TYPES).map(k => constants.SENSOR_TYPES[k]).reduce((prev, obj) => {
          if (prev) return prev
          if (obj.type === row.sensortype) return obj
        }, undefined)
        const value = `${row.sensorvalue}${sensortype.denominator}`
        const name = `${row.sensorname ? row.sensorname : 'NN'} (${row.devicename ? row.devicename : 'NN'})`
        return {
          'value': value,
          'name': name,
          'dt': strdate,
          'last': mins,
          'raw': {
            "sensor": {
              'id': row.sensorid,
              'value': row.sensorvalue,
              'denominator': sensortype.donominator,
              'name': row.sensorname,
              'type': sensortype.type,
            },
            "device": {
              "id": row.deviceid,
              "name": row.devicename
            }
          }
        }
      })
    }
    let context = {'updated': formatDate()}
    
    srvc.db.queryAllLatestSensorValues().then(rs => {
      let data = parse(rs.rows)
      context.data = data
      res.render('dashboard', context)
    }).catch(err => {
      console.log(err)  
    })
})

module.exports = router
