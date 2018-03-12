const express = require('express')
const bodyparser = require('body-parser')

const app = express()
app.use(bodyparser.json())

app.post('/*', (req, res) => {
  let counter = req.body.counter
  console.log(`Received counter: ${counter}`)
  res.setHeader('Content-Type', 'text/plain')
  res.send(`Thank you - you posted: ${counter}\n`).end()
})
app.get('/*', (req, res) => {
  res.setHeader('Content-Type', 'text/plain')
  res.send('HelloWorld...').end()
})

app.listen(process.env.PORT || 8080)
