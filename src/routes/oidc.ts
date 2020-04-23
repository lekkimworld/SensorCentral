import express from "express";
import {getOidcClient} from "../oidc-authentication-utils";
import { HttpException, LoginSource, BackendLoginUser } from "../types";
import { StorageService, CreateLoginUserInput } from "../services/storage-service";
//@ts-ignore
import { lookupService } from "../configure-services";

// create a router
const router = express.Router();
    
router.get("/callback", async (req, res, next) => {
    const nonce = req.session!.nonce;
    if (!nonce) return next(new HttpException(417, `No nonce found (<${nonce}>)`));
    
    // get client
    const oidcClient = await getOidcClient();

    // get params
    const callbackParams = oidcClient.callbackParams(req);
    const callbackExtras = process.env.OIDC_POST_CLIENT_SECRET ? {
        "exchangeBody": {
            "client_secret": process.env.OIDC_CLIENT_SECRET
        }
    } : {};
    oidcClient.callback(process.env.OIDC_REDIRECT_URI, callbackParams, { nonce }, callbackExtras).then((tokenSet) => {
        // get claims and validate hosted domain
        const claims = tokenSet.claims();
        if (process.env.GOOGLE_HOSTED_DOMAIN && (!claims.hd || claims.hd !== process.env.GOOGLE_HOSTED_DOMAIN)) {
            return next(new HttpException(417, "Unable to validate hosted domain claim"));
        }
        
        // ensure we have a row in LOGIN_USER for the user
        lookupService("storage").then((storage : StorageService) => {
            return storage.getOrCreateLoginUser({
                source: LoginSource.google, 
                oidc_sub: claims.sub as string, 
                email: claims.email as string,
                ln: claims.family_name,
                fn: claims.given_name
            } as CreateLoginUserInput);

        }).then((user : BackendLoginUser) => {
            // set the claims we received, set user in session and redirect
            req.session!.user = user;

            // redirect
            res.redirect("/openid/loggedin");
        })
    });
})

router.get("/loggedin", ({res}) => {
    return res!.render("loggedin");
})

router.get("/logout", (req, res, next) => {
    if (req.session) {
        req.session.destroy(err => {
            if (err) {
                return next(new HttpException(500, "Unable to invalidate session", err));
            }
            res.redirect("/openid/loggedout");
        })
    } else {
        res.redirect("/openid/loggedout");
    }
})

export default router;
