const express = require('express')
const router = express.Router()
const moment = require('moment-timezone')
const srvc = require('../configure-services.js')

router.get('/', (req, res) => {
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
    
    srvc.db.query("select d.dt dt, de.id deviceId, d.id sensorId, s.name sensorName, de.name deviceName, round(cast(d.value as numeric), 1) sensorValue from (select id, dt, value from (select row_number() over (partition by id order by dt desc) as r, t.* from sensor_data t) x where x.r < 2) d left outer join sensor s on d.id=s.id left outer join device de on de.id=s.deviceId order by de.name, s.name;").then(rs => {
      let data = parse(rs.rows)
      context.data = data
      res.render('dashboard', context)
    }).catch(err => {
      console.log(err)  
    })
    
    /*
   let data = parse([
     {'sensorid': '1', 'sensorname': 'sensor1', 'sensorvalue': 1.1, 'deviceid': 'd1', 'devicename': 'device 1', 'dt': new Date()}
   ])
   context.data = data
   res.render('dashboard', context)
  */
})

module.exports = router
