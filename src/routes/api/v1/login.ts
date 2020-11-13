import express from "express";
import { getAuthenticationUrl, AuthenticationUrlPayload } from "../../../oidc-authentication-utils";
import { DeviceJWTPayload, HttpException, BrowserLoginPayload, BackendLoginUser, LoginUser } from "../../../types";
import ensureAuthenticated from "../../../middleware/ensureAuthenticated";
import jwt from "jsonwebtoken";
import constants from "../../../constants";
import { ensureAdminJWTScope } from "../../../middleware/ensureScope";
//@ts-ignore
import {lookupService} from "../../../configure-services";
import { StorageService } from "../../../services/storage-service";

const generateJWT = async (userOrDeviceId : string, houseId : string, scopes : string[]) => {
    const token = await jwt.sign({
        "scopes": scopes.join(" "),
        "houseid": houseId
    }, process.env.API_JWT_SECRET as string, {
        "algorithm": "HS256",
        "issuer": constants.JWT.OUR_ISSUER,
        "audience": constants.JWT.AUDIENCE,
        "subject": userOrDeviceId
    });
    return token;
}

const generateUserJWT = async (userId : string, houseId : string) => {
    return generateJWT(userId, houseId, constants.DEFAULTS.JWT.USER_SCOPES);
}

const generateDeviceJWT = async (deviceId : string, houseId : string) => {
    return generateJWT(deviceId, houseId, constants.DEFAULTS.JWT.DEVICE_SCOPES);
}

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
        } as AuthenticationUrlPayload)
    })

})

/**
 * Generates a JWT for the supplied device ID and returns it.
 * 
 */
router.post("/jwt", ensureAuthenticated, ensureAdminJWTScope, async (req, res, next) => {
    // validate
    const deviceid = req.body.device;
    const houseid = req.body.house;
    if (!deviceid) {
        return next(new HttpException(417, "Missing device ID in \"device\" property"));
    }
    if (!houseid) {
        return next(new HttpException(417, "Missing house ID in \"house\" property"));
    }

    try {
        // create JWT
        const token = await generateDeviceJWT(deviceid, houseid);
        return res.send({
            token
        } as DeviceJWTPayload);

    } catch (err) {
        return next(new HttpException(500, "Unable to generate JWT", err));
    }
})

/**
 * Returns a payload to the authenticated caller with a JWT and a user object. If called 
 * with a houseId we check that the houseId is valid for the user and if yes returns a 
 * JWT with that houseId. If no houseId is supplied the JWT returned is for the default 
 * house if any.
 * 
 */
//@ts-ignore
router.get("/jwt/:houseId?", ensureAuthenticated, async (req, res, next) => {
    const user = res.locals.user as BackendLoginUser;

    // get all houses for the user
    const storage = await lookupService("storage") as StorageService;
    const houses = await storage.getHouses();

    // get houseid for jwt
    let houseId = req.params.houseId;
    if (!houseId) {
        // pick first houseid
        houseId = houses[0].id;
    }

    try {
        // create JWT for user
        const token = await generateUserJWT(user.id, houseId);
        const payload = {
            "jwt": token,
            "user": {
                "id": user.id,
                "fn": user.fn,
                "ln": user.ln,
                "houseId": houseId,
                "email": user.email,
                "houses": houses
            } as LoginUser
        } as BrowserLoginPayload;

        // remove cached user
        storage.updateCachedBackendLoginUser(user.id, houseId);

        // send
        res.send(payload);

    } catch (err) {
        return next(new HttpException(500, "Unable to generate JWT", err));
    }
})

export default router;
