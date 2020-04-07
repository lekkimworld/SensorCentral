import * as express from 'express';
import { BaseService, Sensor, RedisSensorMessage, Device, SensorType, WatchdogNotification, House, APIUserContext } from '../../../types';
import { StorageService } from '../../../services/storage-service';
import { stringify } from 'querystring';
import { read } from 'fs';
import { LogService } from '../../../services/log-service';
import { userInfo } from 'os';
const {lookupService} = require('../../../configure-services');
import jwt from "jsonwebtoken";
import {constants} from "../../../constants";
import { AuthenticationParameters, authenticationUrl } from "../../../authentication-utils";

const router = express.Router();

// set default response type to json
router.use((req, res, next) => {
    res.type('json');
    next();
})

router.get("/login", (req, res) => {
    authenticationUrl().then(result => {
        req.session!.nonce = result.nonce;
        req.session!.save(err => {
            // abort if errror
            if (err) {
                return res.status(500).send({"error": true, "message": "Unable to save session"});
            }

            // return response
            res.send({
                "url": result.url
            })
        })
    })
})

router.get("/login/jwt", (req, res) => {
    const secret = process.env.API_JWT_SECRET as string;
    jwt.sign({
        "scopes": [
            constants.DEFAULTS.API.JWT.SCOPE_API,
            constants.DEFAULTS.API.JWT.SCOPE_SENSORDATA,
            constants.DEFAULTS.API.JWT.SCOPE_ADMIN
        ].join(" "),
        "houseid": "*"
    }, secret, {
        "algorithm": "HS256",
        "issuer": constants.DEFAULTS.API.JWT.OUR_ISSUER,
        "audience": constants.DEFAULTS.API.JWT.AUDIENCE,
        "subject": req.session!.user.email || process.env.OIDC_POST_CLIENT_SECRET
    }, (err, token) => {
        if (err) {
            res.status(500).send({"error": true, "message": "Unable to generate JWT"});
        } else {
            res.send({
                "jwt": token,
                "user": req.session!.user
            });
        }
    })
})

// ensure user is authenticated
router.use((req, res, next) => {
    // see if we have a user
    if (req.session && req.session.user) {
        // create api context to make life easier
        const scopes = [
            constants.DEFAULTS.API.JWT.SCOPE_API, 
            constants.DEFAULTS.API.JWT.SCOPE_ADMIN_JWT, 
            constants.DEFAULTS.API.JWT.SCOPE_ADMIN,
            constants.DEFAULTS.API.JWT.SCOPE_READ,
            constants.DEFAULTS.API.JWT.SCOPE_SENSORDATA
        ];
        const apictx : APIUserContext = {
            "audience": req.session.user.aud,
            "issuer": req.session.user.iss,
            "subject": req.session.user.sub,
            "scopes": scopes,
            "houseid": "*",
            "accessAllHouses": () => true,
            "hasScope": (scope) => scopes.includes(scope)
        }
        res.locals.api_context = apictx;
        return next();
    }

    if (req.headers && req.headers.authorization && req.headers.authorization.indexOf("Bearer ") === 0) {
        // get token
        const token = req.headers.authorization.substring(7);
        const secret = process.env.API_JWT_SECRET as string;

        // verify token
        jwt.verify(token, secret, {
            "algorithms": ["HS256"],
            "audience": constants.DEFAULTS.API.JWT.AUDIENCE,
            "issuer": constants.DEFAULTS.API.JWT.ISSUERS
        }, (err : Error, decoded : any) => {
            // abort on error
            if (err) return res.status(401).send(`Error: ${err.message}`);

            // verify scope contains api
            if (!decoded.scopes || !decoded.scopes.split(" ").includes(constants.DEFAULTS.API.JWT.SCOPE_API)) {
                return res.status(401).send("Missing API scope");
            }

            // set context for call
            const apictx : APIUserContext = {
                "audience": decoded.aud,
                "issuer": decoded.iss,
                "subject": decoded.sub,
                "houseid": decoded.houseid,
                "scopes": decoded.scopes.split(" "),
                "accessAllHouses": () => {
                    return "*" === decoded.houseid;
                },
                "hasScope": (scope) => {
                    return decoded.scopes.split(" ").includes(scope);
                }
            }
            res.locals.api_context = apictx;

            // forward
            next();
        })
        return;
    }

    // no access
    return res.status(401).send("Unauthorized");
})

router.post("/jwt", (req, res) => {
    // get context
    const apictx = res.locals.api_context as APIUserContext;
    if (!apictx.hasScope(constants.DEFAULTS.API.JWT.SCOPE_ADMIN_JWT)) return res.status(401).send(`Missing ${constants.DEFAULTS.API.JWT.SCOPE_ADMIN_JWT} scope`);

    // verify content type and get sensor id
    if (req.headers["content-type"] !== "application/json") {
        return res.status(417).send("Only accepts application/json");
    }
    const deviceid = req.body.device;
    const houseid = req.body.house;
    if (!deviceid) {
        return res.status(417).send("Missing device ID in \"device\" property");
    }
    if (!houseid) {
        return res.status(417).send("Missing house ID in \"house\" property");
    }

    const secret = process.env.API_JWT_SECRET as string;
    jwt.sign({
        "scopes": `${constants.DEFAULTS.API.JWT.SCOPE_API} ${constants.DEFAULTS.API.JWT.SCOPE_SENSORDATA}`,
        "houseid": houseid
    }, secret, {
        "algorithm": "HS256",
        "issuer": constants.DEFAULTS.API.JWT.OUR_ISSUER,
        "audience": constants.DEFAULTS.API.JWT.AUDIENCE,
        "subject": deviceid
    }, (err, token) => {
        res.send(token);
    })
})

// *****************************************
// DATA
// *****************************************
import dataRoutes from "./data";
router.use('/data', dataRoutes);

// *****************************************
// HOUSES
// *****************************************
import houseRoutes from "./houses";
router.use("/houses", houseRoutes);


// *****************************************
// DEVICES
// *****************************************
import deviceRoutes from "./devices";
router.use("/devices", deviceRoutes);


// *****************************************
// SENSORS
// *****************************************
import sensorRoutes from "./sensors";
router.use("/sensors", sensorRoutes);

// *****************************************
// EXCEL
// *****************************************
import excelRoutes from "./excel";
router.use("/excel", excelRoutes);

export default router;
