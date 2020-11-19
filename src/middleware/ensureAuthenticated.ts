import { Request, Response, NextFunction } from "express";
import constants from "../constants";
import { BrowserLoginResponse, HttpException } from "../types";
//@ts-ignore
import { lookupService } from "../configure-services";
import { IdentityService } from "../services/identity-service";

export default async (req : Request, res : Response, next : NextFunction) => {
    // get service
    const identity = await lookupService(IdentityService.NAME) as IdentityService;

    // see if we have a session with a userId
    if (req.session && req.session.browserResponse) {
        // we do - get userId and convert to a user object
        const resp = req.session.browserResponse as BrowserLoginResponse;
        const user = await identity.getLoginUserIdentity(resp.userinfo.id, resp.userinfo.houseId);
        res.locals.user = user;

        // remove from session
        delete req.session.browserResponse;
        
        // continue
        return next();
    }
    
    if (req.headers && req.headers.authorization && req.headers.authorization.indexOf("Bearer ") === 0) {
        // get token
        const token = req.headers.authorization.substring(7);

        try {
            // verify token
            const ident = await identity.verifyJWT(token);
            
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