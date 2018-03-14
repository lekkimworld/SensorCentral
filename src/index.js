const express = require('express')
const bodyparser = require('body-parser')
const terminateListener = require('./terminate-listener.js');
const pg = require('pg');
const connectionString = process.env.DATABASE_URL || 'postgres://localhost:5432/todo';

// connect to db
const client = new pg.Client(connectionString);
client.connect();

const app = express()
app.use(bodyparser.json())

app.post('/*', (req, res) => {
  req.body.forEach(element => {
    client.query(`insert into sensor_data (dt, id, value) values (current_timestamp, '${element.sensorId}', ${element.sensorValue});`);
  });
  let j = JSON.stringify(req.body, undefined, 2)
  console.log(`Received: ${j}`)
  res.setHeader('Content-Type', 'text/plain')
  res.send(`Thank you - you posted: ${j}\n`).end()
})
app.get('/*', (req, res) => {
  const minutes = req.param.minutes || 240
  const results = []
  const query = client.query(`select s.id id, s.name sensor_name, to_char(d.dt, 'YYYY-MM-DD HH24:MI:SS') dt, d.value from sensor_data d, sensor s where d.id=s.id and current_timestamp - dt < interval '${minutes} minutes' order by id asc, dt asc`, (err, resultSet) => {
    res.setHeader('Content-Type', 'text/plain')
    
    resultSet.rows.forEach(row => {
      res.write(`${row[0]};${row[1]};${row[2]};${row[3]}\n`)  
    })
    res.end()
  })
  
})

app.listen(process.env.PORT || 8080)

// setup termination listener
terminateListener(() => {
  console.log("Closing postgres driver");
  client.end();
  console.log("Closed postgres driver");
});
