import { Request, Response, NextFunction } from "express";
import { HttpException, BackendIdentity } from "../types";
import constants from "../constants";

export const hasScope = (user : BackendIdentity, scope : string) => {
    return user.scopes && user.scopes.includes(scope);
}

export const ensureScopesWithMethodFactory = (scopes : string[], method? : string) => (req : Request, res : Response, next : NextFunction) => {
    // get user
    const user = res.locals.user as BackendIdentity;
    
    // ensure user has all required scopes
    if ((!method || method === req.method) && scopes.every(s => user.scopes.includes(s))) {
        // if methods supplied ensu
        return next();
    } else {
        return next(new HttpException(401, `Unauthorized - requires <${scopes.join()}> scope(s)`));
    }
}

export const ensureScopeFactory = (scope : string) => ensureScopesWithMethodFactory([scope]);
export const ensureReadScopeWhenGetRequest = ensureScopesWithMethodFactory([constants.JWT.SCOPE_READ], "get");
export const ensureAdminScope = ensureScopesWithMethodFactory([constants.JWT.SCOPE_ADMIN]);
export const ensureAdminJWTScope = ensureScopesWithMethodFactory([constants.JWT.SCOPE_ADMIN_JWT]);
