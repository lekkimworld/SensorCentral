import { Request, Response, NextFunction } from "express";
import constants from "../constants";
import { HttpException, BackendLoginUser } from "../types";
import jwt from "jsonwebtoken";
//@ts-ignore
import { lookupService } from "../configure-services";
import { StorageService } from "../services/storage-service";

export default async (req : Request, res : Response, next : NextFunction) => {
    // see if we have a session and hence a user
    if (req.session && req.session.user) {
        // we do - get it and set in res.locals
        const user = req.session.user as BackendLoginUser;
        res.locals.user = user;
        return next();
    }
    
    if (req.headers && req.headers.authorization && req.headers.authorization.indexOf("Bearer ") === 0) {
        // get token
        const token = req.headers.authorization.substring(7);
        const secret = process.env.API_JWT_SECRET as string;

        try {
            // verify token
            const decoded : any = await jwt.verify(token, secret, {
                "algorithms": ["HS256"],
                "audience": constants.JWT.AUDIENCE,
                "issuer": constants.JWT.ISSUERS
            })
            if (!decoded) return next(new HttpException(401, `Didn't get decoded JWT as expected`));

            // verify scope contains api
            if (!decoded.scopes || !decoded.scopes.split(" ").includes(constants.JWT.SCOPE_API)) {
                return next(new HttpException(401, `Missing ${constants.JWT.SCOPE_API} scope`));
            }

            // lookup user
            const storage = await lookupService("storage") as StorageService;
            try {
                const user = await storage.lookupBackendLoginUser(decoded.sub);
                res.locals.user = user;

                // forward
                return next();

            } catch (err) {
                return next(new HttpException(401, "Login not known", err));
            }

        } catch (err) {
            if (err) return next(new HttpException(401, `Error: ${err.message}`, err));
        }
    }

    // no access
    return next(new HttpException(401, "Unauthorized"));
}