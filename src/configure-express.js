const express = require('express')
const Handlebars = require("handlebars")
const exphbs = require("express-handlebars")
const bodyparser = require('body-parser')
const session = require("express-session");
const path = require('path')
const uuid = require("uuid/v4");
const routes = require('./configure-routes')
const { Issuer, generators } = require('openid-client');
const configureSessionWithRedis = require("./configure-session");
const { lookupService } = require("./configure-services");
const { RedisService } = require("./services/redis-service");
const { LogService } = require("./services/log-service");
const { oidcIssuerPromise } = require("./authentication-utils");

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

// sessions
lookupService("redis").then(redisService => {
    app.use(configureSessionWithRedis(redisService.getClient()));
})

// build OpenID client
oidcIssuerPromise.then(client => {
    app.get("/openid/callback", (req, res) => {
        const nonce = req.session.nonce;
        if (!nonce) return res.status(417).send(`No nonce found (<${nonce}>)`);
        
        // get params
        const callbackParams = client.callbackParams(req);
        const callbackExtras = process.env.OIDC_POST_CLIENT_SECRET ? {
            "exchangeBody": {
                "client_secret": process.env.OIDC_CLIENT_SECRET
            }
        } : {};
        client.callback(process.env.OIDC_REDIRECT_URI, callbackParams, { nonce }, callbackExtras).then((tokenSet) => {
            // get claims and validate hosted domain
            const claims = tokenSet.claims();
            if (process.env.GOOGLE_HOSTED_DOMAIN && (!claims.hd || claims.hd !== process.env.GOOGLE_HOSTED_DOMAIN)) {
                return res.status(417).send("Unable to validate hosted domain claim");
            }

            // save in session and redirect
            req.session.user = claims;

            // redirect
            res.redirect("/openid/loggedin");
            
        });
    })
    app.get("/openid/loggedin", (req, res) => {
        return res.render("loggedin");
    })
    app.get("/openid/logout", (req, res) => {
        if (req.session || req.session.user) {
            delete req.session.user;
            delete req.session.nonce;
            res.redirect("/openid/loggedout");
        }
    })

    // add routes to app
    routes.routes(app);
})

// middleware
app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

Handlebars.registerHelper({
    eq: function (v1, v2) {
        return v1 === v2;
    },
    ne: function (v1, v2) {
        return v1 !== v2;
    },
    lt: function (v1, v2) {
        return v1 < v2;
    },
    gt: function (v1, v2) {
        return v1 > v2;
    },
    lte: function (v1, v2) {
        return v1 <= v2;
    },
    gte: function (v1, v2) {
        return v1 >= v2;
    },
    and: function () {
        return Array.prototype.slice.call(arguments).every(Boolean);
    },
    or: function () {
        return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
    }
});

module.exports = () => {
    // return the app
    return app
}
