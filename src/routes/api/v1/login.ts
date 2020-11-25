import express from "express";
import { getAuthenticationUrl, AuthenticationUrlPayload } from "../../../oidc-authentication-utils";
import { JWTPayload, HttpException, BrowserLoginResponse, BackendIdentity, UserPrincipal } from "../../../types";
import ensureAuthenticated from "../../../middleware/ensureAuthenticated";
import { ensureAdminJWTScope } from "../../../middleware/ensureScope";
//@ts-ignore
import {lookupService} from "../../../configure-services";
import { StorageService } from "../../../services/storage-service";
import { IdentityService } from "../../../services/identity-service";
import { LogService } from "../../../services/log-service";

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
    const user = res.locals.user;
    const deviceid = req.body.device;
    const houseid = req.body.house;
    if (!deviceid) {
        return next(new HttpException(417, "Missing device ID in \"device\" property"));
    }
    if (!houseid) {
        return next(new HttpException(417, "Missing house ID in \"house\" property"));
    }

    // get security service
    const identity = await lookupService(IdentityService.NAME) as IdentityService;

    try {
        // create JWT
        const token = await identity.generateDeviceJWT(user, deviceid);
        return res.send({
            token
        } as JWTPayload);

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
    // get services
    const svcs = await lookupService([StorageService.NAME, IdentityService.NAME, LogService.NAME]);
    const storage = svcs[0] as StorageService;
    const identitySvcs = svcs[1] as IdentityService;
    const logSvcs = svcs[2] as LogService;
    logSvcs.debug(`User asked for new JWT supplying houseId <${req.params.houseId}>`);

    // get all houses for the user
    const user = res.locals.user as BackendIdentity;
    const houses = await storage.getHouses(user);

    // get houseid for jwt
    let houseId = req.params.houseId;
    logSvcs.debug(`Extracted houseId from req.params <${houseId}>`);
    if (!houseId) {
        logSvcs.debug("No houseId in req.params");
        if (user.identity.houseId) {
            houseId = user.identity.houseId;
            logSvcs.debug(`Extracted houseId from user.identity <${houseId}>`);
        } else if (houses && houses.length) {
            // pick first houseid
            houseId = houses[0].id;
            logSvcs.debug(`Took houseId from first house <${houseId}>`);
        }
    }

    try {
        const jwt = await identitySvcs.generateUserJWT(user, houseId);
        const p = user.principal as UserPrincipal;
        const payload = {
            "userinfo": {
                "id": user.identity.callerId,
                "email": p.email,
                "fn": p.fn,
                "ln": p.ln,
                "houseId": houseId,
                "houses": houses
            },
            jwt
        } as BrowserLoginResponse;
        logSvcs.debug(`Generated new BrowserLoginResponse <${JSON.stringify(payload)}>`);

        // remove cached user
        identitySvcs.removeCachedIdentity(user);

        // send
        res.send(payload);

    } catch (err) {
        return next(new HttpException(500, "Unable to generate JWT", err));
    }
})

export default router;
