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
Issuer.discover("https://accounts.google.com").then(googleIssuer => {
    const client = new googleIssuer.Client({
        "client_id": process.env.GOOGLE_CLIENT_ID,
        "client_secret": process.env.GOOGLE_CLIENT_SECRET,
        "redirect_uris": [process.env.GOOGLE_REDIRECT_URI],
        "response_types": ["code"]
    })
    app.get("/openid/callback", (req, res) => {
        const nonce = req.session.nonce;
        if (!nonce) return res.status(417).send("No nonce found");
        delete req.session.nonce;

        // get params
        const params = client.callbackParams(req);
        client.callback(process.env.GOOGLE_REDIRECT_URI, params, { nonce }).then((tokenSet) => {
            // get claims and validate hosted domain
            const claims = tokenSet.claims();
            if (process.env.GOOGLE_HOSTED_DOMAIN && (!claims.hd || claims.hd !== process.env.GOOGLE_HOSTED_DOMAIN)) {
                return res.status(417).send("Unable to validate hosted domain claim");
            }

            // save in session and redirect
            req.session.user = claims;

            // see if we have a url saved from when user made request before auth dance
            if (req.session && req.session.temp_url) {
                res.redirect(req.session.temp_url);
            } else {
                res.redirect("/");
            }
        });
    })
    app.get("/openid/logout", (req, res) => {
        if (req.session || req.session.user) {
            delete req.session.user;
            res.redirect("/openid/loggedout");
        }
    })
    app.get("/openid/login", (req, res) => {
        req.session.nonce = generators.nonce();
        const url = client.authorizationUrl({
            "scope": process.env.GOOGLE_SCOPES || "openid email profile",
            "nonce": req.session.nonce,
        });
        if (process.env.GOOGLE_HOSTED_DOMAIN) {
            return res.redirect(`${url}&hd=${process.env.GOOGLE_HOSTED_DOMAIN}`);
        } else {
            return res.redirect(url);
        }
    })

    /**
     * Ensure requests are authenticated
     */
    app.use((req, res, next) => {
        // see if we have a user in the session and it's not expired
        if (req.session.user && req.session.user.exp < Date.now()) return next();

        // see if api - it has separate auth requirements
        if (req.originalUrl.startsWith("/api/")) return next();

        // see if posting to root as it's the legacy post endpoint for devices
        if (req.originalUrl === "/" && req.method === "POST" && req.headers["content-type"] === "application/json") {
            // legacy post
            lookupService("log").then(log => {
                const deviceid = req.body.deviceId;
                log.warn(`Received LEGACY POST from device (ip <${req.ip}>, device <${deviceid}>)`);
            })
            return next();
        }

        // see if legacy scrapedata for prometheus
        if (req.originalUrl === "/scrapedata" && req.method === "GET") {
            // legacy post
            lookupService("log").then(log => {
                log.warn(`Received LEGACY GET for scrapedata endpoint (ip <${req.ip}>)`);
            })
            return next();
        }

        // get requested url
        req.session.temp_url = req.originalUrl;

        // send to login page
        res.redirect("/openid/login");
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
