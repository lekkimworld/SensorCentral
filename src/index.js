const express = require('express')
const bodyparser = require('body-parser')

const app = express()
app.use(bodyparser.json())

app.post('/*', (req, res) => {
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
