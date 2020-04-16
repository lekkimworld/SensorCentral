import express, { Request, Response, NextFunction } from 'express';
import Handlebars from "handlebars";
import exphbs from "express-handlebars";
import bodyparser from 'body-parser';
import path from 'path';
import attachApplicationRoutes from './configure-routes';
import configureSessionWithRedis from "./configure-session";
//@ts-ignore
import { lookupService } from "./configure-services";
import { oidcIssuerPromise } from "./authentication-utils";
import { RedisService } from './services/redis-service';
import { HttpException } from "./types";

// configure app
const app = express();
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(bodyparser.json());

// sessions
lookupService("redis").then((redisService : RedisService) => {
    app.use(configureSessionWithRedis(redisService.getClient()));
})

// build OpenID client
oidcIssuerPromise.then(client => {
    app.get("/openid/callback", (req, res) => {
        const nonce = req.session!.nonce;
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
            req.session!.user = claims;

            // redirect
            res.redirect("/openid/loggedin");
            
        });
    })
    app.get("/openid/loggedin", ({res}) => {
        return res!.render("loggedin");
    })
    app.get("/openid/logout", (req, res) => {
        if (req.session) {
            delete req.session.user;
            delete req.session.nonce;
            res.redirect("/openid/loggedout");
        }
    })

    // add routes to app
    attachApplicationRoutes(app);
})

// add handlebars
app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

// catch errors
app.use((err : HttpException, req : Request, res : Response, next : NextFunction) => {
    err;
    req;
    res;
    next(); 
})

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

export default () => {
    // return the app
    return app
}
