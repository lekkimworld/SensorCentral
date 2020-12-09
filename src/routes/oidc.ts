import express from "express";
import {getOidcClient} from "../oidc-authentication-utils";
import { BrowserLoginResponse, HttpException, LoginSource } from "../types";
import { CreateLoginUserInput } from "../services/identity-service";
//@ts-ignore
import { lookupService } from "../configure-services";
import { buildBaseHandlebarsContext } from "../utils";
import { IdentityService } from "../services/identity-service";

// create a router
const router = express.Router();

/**
 * Callback from the OIDC provider.
 * 
 */
router.get("/callback", async (req, res, next) => {
    const session = req.session as any;
    const nonce = session!.nonce;
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
        lookupService(IdentityService.NAME).then((identity : IdentityService) => {
            return identity.getOrCreateBrowserLoginResponse({
                source: LoginSource.google, 
                oidc_sub: claims.sub as string, 
                email: claims.email as string,
                ln: claims.family_name,
                fn: claims.given_name
            } as CreateLoginUserInput);

        }).then((output : BrowserLoginResponse) => {
            // set the claims we received, set userId in session and redirect
            const session = req.session as any;
            session!.browserResponse = output;

            // redirect
            res.redirect("/openid/loggedin");
        })
    });
})

/**
 * After logging in the user is redirected to this URL.
 */
router.get("/loggedin", ({res}) => {
    return res!.render("loggedin", Object.assign({}, buildBaseHandlebarsContext()));
})

export default router;
