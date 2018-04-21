const {Pool} = require('pg')
const express = require('express')
const exphbs = require("express-handlebars")
const path = require('path')
const bodyparser = require('body-parser')
const moment = require('moment-timezone')
const PubNub = require('pubnub')
const constants = require('./constants.js')

// load environment variables for localhost
try {
	env(path.join(__dirname, '.env'));
} catch (e) {}

// max temp to register
const MAX_REGISTER_TEMP = process.env.MAX_REGISTER_TEMP || 60
const MIN_REGISTER_TEMP = process.env.MIN_REGISTER_TEMP || -60

// create a pubnub client
const pubnub = new PubNub({
  'subscribeKey': process.env.PUBNUB_SUBSCRIBE_KEY,
  'publishKey': process.env.PUBNUB_PUBLISH_KEY,
  'ssl': true
})

// connect to db using pool
const pool = new Pool({
  'connectionString': process.env.DATABASE_URL,
  'ssl': true
})

// configure app
const app = express()
app.use(express.static(path.join(__dirname, '..', 'public')))
app.use(bodyparser.json())

// middleware
app.engine('handlebars', exphbs({defaultLayout: 'main'}))
app.set('view engine', 'handlebars')

app.post('/*', (req, res) => {
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
    if (element.sensorValue > MAX_REGISTER_TEMP || element.sensorValue < MIN_REGISTER_TEMP) {
      console.log(`Ignoring value of ${element.sensorValue} from ${element.sensorId} as value to is too high (> ${MAX_REGISTER_TEMP}) or too low (< ${MIN_REGISTER_TEMP})`)
      return
    }

    // post message about sensor reading
    pubnub.publish({
      'message': {
        'sensorValue': element.sensorValue,
        'sensorId': element.sensorId
      },
      'channel': constants.PUBNUB.RAW_CHANNEL_NAME
    }, (status, response) => {
      if (status.error) {
        console.log(`ERROR -  could NOT post value of ${element.sensorValue} from ${element.sensorId} as value to channel ${constants.PUBNUB.RAW_CHANNEL_NAME}`)
        console.log(status)
      } else {
        console.log(`SUCCESS - posted value of ${element.sensorValue} from ${element.sensorId} as value to channel ${constants.PUBNUB.RAW_CHANNEL_NAME}`)
      }
    })
  });

  // acknowledge post
  let j = JSON.stringify(data, undefined, 2)
  console.log(`Received: ${j}`)
  res.setHeader('Content-Type', 'text/plain')
  res.send(`Thank you - you posted: ${j}\n`).end()
})

app.get('/', (req, res) => {
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
  
  pool.query("select d.dt dt, de.id deviceId, d.id sensorId, s.name sensorName, de.name deviceName, round(cast(d.value as numeric), 1) sensorValue from (select id, dt, value from (select row_number() over (partition by id order by dt desc) as r, t.* from sensor_data t) x where x.r < 2) d left outer join sensor s on d.id=s.id join device de on de.id=s.deviceId order by de.name, s.name;", (err, resultSet) => {
    let data = parse(resultSet.rows)
    context.data = data
    res.render('dashboard', context)
  })
  
  /*
 let data = parse([
   {'sensorid': '1', 'sensorname': 'sensor1', 'sensorvalue': 1.1, 'deviceid': 'd1', 'devicename': 'device 1', 'dt': new Date()}
 ])
 context.data = data
 res.render('dashboard', context)
*/
})

console.log(`Starting to listen for HTTP traffic on port ${process.env.PORT || 8080}`)
app.listen(process.env.PORT || 8080)

