import express from "express";
import { getAuthenticationUrl, AuthenticationUrlPayload } from "../../../oidc-authentication-utils";
import { JWTPayload, HttpException, BrowserLoginResponse, BackendIdentity, UserPrincipal } from "../../../types";
import ensureAuthenticated from "../../../middleware/ensureAuthenticated";
import { ensureAdminJWTScope } from "../../../middleware/ensureScope";
//@ts-ignore
import {lookupService} from "../../../configure-services";
import { StorageService } from "../../../services/storage-service";
import { IdentityService } from "../../../services/identity-service";
import { Logger } from "../../../logger";

declare module "express-session" {
    export interface SessionData {
        nonce: string;
        browserResponse: BrowserLoginResponse;

        // used when adding login provider
        oidc_add: boolean;
        oidc_userid: string;
    }
}

const logger = new Logger("login");
const router = express.Router();

/**
 * Returns the login url to the (anonymous) caller.
 */
router.get("/:provider", async (req, res, next) => {
    if (req.params.provider === "jwt") return next();

    // get url
    const result = await getAuthenticationUrl(req.params.provider);

    // get session
    const session = req.session;

    // look for authorization header - if found we assume we are adding
    // login provider to account
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
        // extract JWT
        const bearerToken = req.headers.authorization.substring(7);

        // verify
        const identityService = (await lookupService(IdentityService.NAME)) as IdentityService;
        const identity = await identityService.verifyJWT(bearerToken);

        // set flag in session to indicate we are adding login provider
        session!.oidc_add = true;
        session!.oidc_userid = identity.identity.callerId;
    }

    // save nonce, save session
    session!.nonce = result.nonce;
    session!.save((err: Error) => {
        // abort if errror
        if (err) {
            return next(new HttpException(500, "Unable to save session", err));
        }

        // return response
        return res.send({
            provider: req.params.provider,
            url: result.url,
        } as AuthenticationUrlPayload);
    });
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
    const svcs = await lookupService([StorageService.NAME, IdentityService.NAME]);
    const storage = svcs[0] as StorageService;
    const identitySvcs = svcs[1] as IdentityService;
    logger.debug(`User asked for new JWT supplying houseId <${req.params.houseId}>`);

    // get all houses for the user
    const user = res.locals.user as BackendIdentity;
    const houses = await storage.getHouses(user);

    // get houseid for jwt
    let houseId = req.params.houseId;
    logger.debug(`Extracted houseId from req.params <${houseId}>`);
    if (!houseId) {
        logger.debug("No houseId in req.params");
        if (user.identity.houseId) {
            houseId = user.identity.houseId;
            logger.debug(`Extracted houseId from user.identity <${houseId}>`);
        } else if (houses && houses.length) {
            // pick first houseid
            houseId = houses[0].id;
            logger.debug(`Took houseId from first house <${houseId}>`);
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
        logger.debug(`Generated new BrowserLoginResponse <${JSON.stringify(payload)}>`);

        // remove cached user (ensure also removed from session if there)
        identitySvcs.removeCachedIdentity(user);
        const session = req.session as any;
        if (session && session.browserResponse) {
            delete session.browserResponse;
            session.save();
        }

        // send
        res.send(payload);

    } catch (err) {
        return next(new HttpException(500, "Unable to generate JWT", err));
    }
})

export default router;
