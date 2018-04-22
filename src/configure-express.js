const express = require('express')
const exphbs = require("express-handlebars")
const bodyparser = require('body-parser')
const path = require('path')
const routes = require('./configure-routes.js')

// configure app
const app = express()
app.use(express.static(path.join(__dirname, '..', 'public')))
app.use(bodyparser.json())

// middleware
app.engine('handlebars', exphbs({defaultLayout: 'main'}))
app.set('view engine', 'handlebars')

// add routes to app
routes(app)

module.exports = () => {
    // return the app
    return app
}
