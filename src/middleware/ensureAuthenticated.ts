import { Request, Response, NextFunction } from "express";
import constants from "../constants";
import { BackendIdentity, BrowserLoginResponse, HttpException } from "../types";
//@ts-ignore
import { lookupService } from "../configure-services";
import { IdentityService } from "../services/identity-service";
import { LogService } from "../services/log-service";

const backendIdentityToString = (user : BackendIdentity) => {
    return `[BackendIdentity - identity.callerId <${user.identity.callerId}> identity.houseId <${user.identity.houseId}> identity.impersonationId <${user.identity.impersonationId}> principal <${user.principal.toString()}>]`;
}

export default async (req : Request, res : Response, next : NextFunction) => {
    // get services
    const svcs = await lookupService([IdentityService.NAME, LogService.NAME])
    const identity = svcs[0] as IdentityService;
    const log = svcs[1] as LogService;

    // see if we have a session with a userId
    log.debug("Looking for session and browserResponse in session");
    const session = req.session as any;
    if (session && session.browserResponse) {
        // we do - get userId and convert to a user object
        log.debug("Found session and browserResponse in session - getting identity");
        const resp = session.browserResponse as BrowserLoginResponse;
        const user = await identity.getLoginUserIdentity(resp.userinfo.id, resp.userinfo.houseId);
        log.debug(`Found identity from session: ${backendIdentityToString(user)}`)
        res.locals.user = user;
        
        // continue
        return next();
    }
    
    log.debug("Looking for authorization header and bearer token");
    if (req.headers && req.headers.authorization && req.headers.authorization.indexOf("Bearer ") === 0) {
        // get token
        const token = req.headers.authorization.substring(7);
        log.debug(`Found bearer token <${token.substring(0,7)}...>`);

        try {
            // verify token
            const ident = await identity.verifyJWT(token);
            log.debug(`Verified identity from bearer token: ${backendIdentityToString(ident)}`);
            
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