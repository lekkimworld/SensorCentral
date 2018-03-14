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
  pg.connect(connectionString, (err, client, done) => {
    // handle connection errors
    if (err) {
      done();
      console.log(err);
      return res.status(500).json({success: false, data: err});
    }

    req.body.forEach(element => {
      client.query(`insert into sensor_data (dt, id, value) values (current_timestamp, '${element.sensorId}', ${element.sensorValue});`);
    });
    done();

    let j = JSON.stringify(req.body, undefined, 2)
    console.log(`Received: ${j}`)
    res.setHeader('Content-Type', 'text/plain')
    res.send(`Thank you - you posted: ${j}\n`).end()
  })
})
app.get('/*', (req, res) => {
  const minutes = req.param.minutes || 240
  
  pg.connect(connectionString, (err, client, done) => {
    // handle connection errors
    if (err) {
      done();
      console.log(err);
      return res.status(500).json({success: false, data: err});
    }

    const results = []
    const query = client.query(`select s.id id, s.name sensor_name, to_char(d.dt, 'YYYY-MM-DD HH24:MI:SS') dt, d.value from sensor_data d, sensor s where d.id=s.id and current_timestamp - dt < interval '${minutes} minutes' order by id asc, dt asc`)
    query.on('row', (row) => {
      results.push(row);
    });

    // all data is returned, close connection and return results
    query.on('end', () => {
      done();
      return res.json(results);
    });
  })
})

app.listen(process.env.PORT || 8080)

// setup termination listener
terminateListener(() => {
  console.log("Closing postgres driver");
  pg.end();
  console.log("Closed postgres driver");
});
