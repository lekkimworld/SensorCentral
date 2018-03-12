const express = require('express')
const bodyparser = require('body-parser')

const app = express()
app.use(bodyparser.json())

app.post('/*', (req, res) => {
  res.setHeader('Content-Type', 'text/plain')
  res.write('you posted:\n')
  res.end(JSON.stringify(req.body, null, 2))
})
app.get('/*', (req, res) => {
  res.setHeader('Content-Type', 'text/plain')
  res.send('HelloWorld...').end()
})

app.listen(process.env.PORT || 8080)
