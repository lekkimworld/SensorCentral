import { Request, Response, NextFunction } from "express";
import constants from "../constants";
import { BackendIdentity, BrowserLoginResponse, HttpException } from "../types";
//@ts-ignore
import { lookupService } from "../configure-services";
import { IdentityService } from "../services/identity-service";
import { Logger } from "../logger";

const backendIdentityToString = (user : BackendIdentity) => {
    return `[BackendIdentity - identity.callerId <${user.identity.callerId}> identity.houseId <${user.identity.houseId}> identity.impersonationId <${user.identity.impersonationId}> principal <${user.principal.toString()}>]`;
}

// logger
const log = new Logger("ensure-authenticated");

/**
 * Middleware used to ensure the request is authentic and that the caller has the api scope 
 * included. If not a 401 is returned.
 */
export default async (req : Request, res : Response, next : NextFunction) => {
    // get services
    const svcs = await lookupService([IdentityService.NAME])
    const identity = svcs[0] as IdentityService;

    // see if we have a session with a userId
    log.trace("Looking for session and browserResponse in session");
    const session = req.session as any;
    if (session && session.browserResponse) {
        // we do - get userId and convert to a user object
        log.trace("Found session and browserResponse in session - getting identity");
        const resp = session.browserResponse as BrowserLoginResponse;
        const user = await identity.getLoginUserIdentity(resp.userinfo.id, resp.userinfo.houseId);
        log.debug(`Found identity from session: ${backendIdentityToString(user)}`)
        res.locals.user = user;
        
        // continue
        return next();
    }
    
    log.trace("Looking for token in authorization header");
    if (req.headers && req.headers.authorization) {
        const authheader = req.headers.authorization;
        let token;

        if (authheader.indexOf("Bearer ") === 0) {
            // get token
            token = req.headers.authorization.substring(7);
            log.debug(`Found token as Bearer token <${token.substring(0,7)}...>`);
        } else if (authheader.indexOf("Basic ") === 0) {
            // get token
            try {
                const basicauth = Buffer.from(req.headers.authorization.substring(6), "base64").toString();
                const parts = basicauth.split(":");
                token = parts[0];
                log.debug(`Found token from Basic Auth <${token.substring(0,7)}...>`);

            } catch (err) {
                return next(new HttpException(401, 'Unable to extract JWT from Basic auth header'));
            }
            
        } else {
            return next(new HttpException(401, "Unsupported Authorization header"));
        }

        try {
            // verify token
            const ident = await identity.verifyJWT(token);
            log.debug(`Verified identity from token: ${backendIdentityToString(ident)}`);
            
            // verify scope contains api
            if (!ident.scopes.includes(constants.JWT.SCOPE_API)) {
                return next(new HttpException(401, `Missing ${constants.JWT.SCOPE_API} scope`));
            }
            res.locals.user = ident;
            return next();

        } catch (err) {
            return next(new HttpException(401, "Unable to ensure an authentic session", err));
        }
    }

    // no access
    return next(new HttpException(401, "Unauthorized"));
}