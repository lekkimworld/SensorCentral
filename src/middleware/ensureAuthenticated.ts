import { Request, Response, NextFunction } from "express";
import constants from "../constants";
import {APIUserContext, HttpException} from "../types";
import jwt, {VerifyErrors} from "jsonwebtoken";

export default (req : Request, res : Response, next : NextFunction) => {
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
        }, (err : VerifyErrors | null, decoded : any | undefined) => {
            // abort on error
            if (err) return next(new HttpException(401, `Error: ${err.message}`, err));
            if (!decoded) return next(new HttpException(401, `Didn't get decoded JWT as expected`));

            // verify scope contains api
            if (!decoded.scopes || !decoded.scopes.split(" ").includes(constants.DEFAULTS.API.JWT.SCOPE_API)) {
                return next(new HttpException(401, "Missing API scope"));
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
            return next();
        })
        return;
    }

    // no access
    return next(new HttpException(401, "Unauthorized"));
}