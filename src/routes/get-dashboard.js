const express = require('express')
const router = express.Router()
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
        return {
          'sensorid': row.sensorid,
          'sensorname': row.sensorname,
          'sensorvalue': row.sensorvalue,
          'devicename': row.devicename,
          'dt': strdate,
          'last': mins
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
