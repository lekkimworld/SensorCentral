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
  res.setHeader('Content-Type', 'text/plain')
  res.send('HelloWorld...').end()
})

app.listen(process.env.PORT || 8080)

// setup termination listener
terminateListener(() => {
  logger.info("Closing postgres driver");
  client.end();
  logger.info("Closed postgres driver");
});
