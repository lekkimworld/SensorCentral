const express = require('express')
const exphbs = require("express-handlebars")
const bodyparser = require('body-parser')
const path = require('path')
const routes = require('./configure-routes.js')

// configure app
const app = express()
app.use(express.static(path.join(__dirname, '..', 'public')))
app.use(bodyparser.json())
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        console.log(`Invalid JSON received <${err.message}> - posted body will follow next`)
        console.log(err.body)
        return res.status(417).send('Invalid data supplied - expected JSON.').end()
    }
    next()
})

// middleware
app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

// add routes to app
routes.routes(app);

module.exports = () => {
    // return the app
    return app
}
