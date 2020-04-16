import express from "express";
import { getAuthenticationUrl, AuthenticationUrl } from "../../../oidc-authentication-utils";
import { HttpException, APIUserContext } from "../../../types";
import ensureAuthenticated from "../../../middleware/ensureAuthenticated";
import jwt from "jsonwebtoken";
import constants from "../../../constants";

const router = express.Router();

/**
 * Returns the login url to the (anonymous) caller.
 */
//@ts-ignore
router.get("/", async (req, res, next) => {
    // get url
    const result = await getAuthenticationUrl();

    // save nonce, save session
    req.session!.nonce = result.nonce;
    req.session!.save(err => {
        // abort if errror
        if (err) {
            return next(new HttpException(500, "Unable to save session", err));
        }

        // return response
        return res.send({
            "url": result.url
        } as AuthenticationUrl)
    })

})

/**
 * Generates a JWT for the supplied device ID and returns it.
 * 
 */
router.post("/jwt", ensureAuthenticated, (req, res, next) => {
    // get context
    const apictx = res.locals.api_context as APIUserContext;
    if (!apictx.hasScope(constants.DEFAULTS.API.JWT.SCOPE_ADMIN_JWT)) next(new HttpException(401, `Missing ${constants.DEFAULTS.API.JWT.SCOPE_ADMIN_JWT} scope`));

    // verify content type and get sensor id
    if (req.headers["content-type"] !== "application/json") {
        return next(new HttpException(417, "Only accepts application/json"));
    }
    const deviceid = req.body.device;
    const houseid = req.body.house;
    if (!deviceid) {
        return next(new HttpException(417, "Missing device ID in \"device\" property"));
    }
    if (!houseid) {
        return next(new HttpException(417, "Missing house ID in \"house\" property"));
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
        if (err) {
            return next(new HttpException(500, `Unable to create JWT (${err.message})`, err));
        } else {
            return res.send({
                token
            });
        }
    })
    return;
})

/**
 * Returns a payload to the authenticated caller with a JWT and a user object.
 * 
 */
router.get("/jwt", ensureAuthenticated, (req, res, next) => {
    const secret = process.env.API_JWT_SECRET as string;
    jwt.sign({
        "scopes": [
            constants.DEFAULTS.API.JWT.SCOPE_API,
            constants.DEFAULTS.API.JWT.SCOPE_SENSORDATA,
            constants.DEFAULTS.API.JWT.SCOPE_ADMIN,
            constants.DEFAULTS.API.JWT.SCOPE_ADMIN_JWT
        ].join(" "),
        "houseid": "*"
    }, secret, {
        "algorithm": "HS256",
        "issuer": constants.DEFAULTS.API.JWT.OUR_ISSUER,
        "audience": constants.DEFAULTS.API.JWT.AUDIENCE,
        "subject": req.session!.user.email || process.env.OIDC_POST_CLIENT_SECRET
    }, (err, token) => {
        if (err) {
            return next(new HttpException(500, "Unable to generate JWT", err));
        } else {
            res.send({
                "jwt": token,
                "user": req.session!.user
            });
        }
    })
})   

export default router;
