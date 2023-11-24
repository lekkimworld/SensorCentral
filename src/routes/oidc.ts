import express from "express";
import { getOidcClient } from "../oidc-authentication-utils";
import { HttpException, LoginSource } from "../types";
import { CreateLoginUserInput } from "../services/identity-service";
//@ts-ignore
import { lookupService } from "../configure-services";
import { buildBaseHandlebarsContext } from "../utils";
import { IdentityService } from "../services/identity-service";
import { Logger } from "../logger";
import {getOidcEndpoint} from "../oidc-authentication-utils";

type OidcClaims = {
    fn: string;
    ln: string;
    email: string | undefined;
    sub: string;
}

// logger
const logger = new Logger("oidc");

// create a router
const router = express.Router();

/**
 * Callback from the OIDC provider.
 * 
 */
router.get("/callback/:provider", async (req, res, next) => {
    const session = req.session;
    const nonce = session!.nonce;
    if (!nonce) return next(new HttpException(417, `No nonce found (<${nonce}>)`));

    try {
        // get endpoint data (throws error on unknown provider)
        const oidcEndpoint = getOidcEndpoint(req.params.provider);

        // get client
        logger.debug("Retrieving OIDC client");
        const oidcClient = await getOidcClient(req.params.provider);
        logger.debug("Retrieved OIDC client");

        // get params
        const callbackParams = oidcClient.callbackParams(req);
        const callbackExtras = {};

        let oidcClaims: OidcClaims | undefined;
        switch (oidcEndpoint.loginSource) {
            case LoginSource.google:
                // get token set
                const tokenSet = await oidcClient.callback(
                    oidcEndpoint.redirectUri,
                    callbackParams,
                    { nonce },
                    callbackExtras
                );
                logger.debug("Performed Google OIDC callback and retrieved tokenset");

                // get claims and validate hosted domain
                const claims = tokenSet.claims();
                logger.debug(`Retrieved Google OIDC claims (${JSON.stringify(claims)})`);

                // create claims
                oidcClaims = {
                    sub: claims.sub as string,
                    email: claims.email as string,
                    ln: claims.family_name as string,
                    fn: claims.given_name as string,
                };

                break;
            case LoginSource.github:
                logger.debug("Exchanging GitHub OIDC code for access_token");
                let resp = await fetch(oidcEndpoint.tokenEndpoint!, {
                    method: "POST",
                    body: `client_id=${oidcEndpoint.clientId}&client_secret=${oidcEndpoint.clientSecret}&redirect_uri=${oidcEndpoint.redirectUri}&code=${callbackParams.code}`,
                    headers: {
                        "content-type": "application/x-www-form-urlencoded",
                        accept: "application/json",
                    },
                });
                if (res.statusCode !== 200)
                    throw new HttpException(417, "Unable to exchange Github authorization code");
                const body = await resp.json();
                logger.debug(`Received GitHub access_token for user - getting userinfo`);
                resp = await fetch(oidcEndpoint.userinfoEndpoint!, {
                    headers: {
                        accept: "application/json",
                        authorization: `Bearer ${body.access_token}`,
                    },
                });
                if (res.statusCode !== 200)
                    throw new HttpException(417, "Unable to get Github userinfo by access_token");

                // parse and extract claims
                const userinfo = await resp.json();

                // create claims
                logger.debug(`Received GitHub claims <${JSON.stringify(userinfo)}>`);
                const name = userinfo.name as string;
                const fn = name.substring(0, name.indexOf(" "));
                const ln = name.substring(name.indexOf(" ") + 1);
                oidcClaims = {
                    sub: userinfo.id as string,
                    email: userinfo.email as string,
                    ln: ln,
                    fn: fn,
                };

                break;
        }

        // get services
        const identService = await lookupService(IdentityService.NAME) as IdentityService;
        
        if (session.oidc_add && session.oidc_userid) {
            // this is a callback for adding a login provider to the account so 
            // we just need to add a mapping
            await identService.addOidcMapping(session.oidc_userid, oidcClaims.sub, oidcEndpoint.loginSource);
            delete session.oidc_add;
            delete session.oidc_userid;
            session.save();
            return res.redirect("/");
        }

        // ensure we have a row in LOGIN_USER for the user
        const output = await identService.getOrCreateBrowserLoginResponse({
            source: oidcEndpoint.loginSource,
            oidc_sub: oidcClaims.sub,
            email: oidcClaims.email,
            ln: oidcClaims.ln,
            fn: oidcClaims.fn,
        } as CreateLoginUserInput);
        logger.debug(`Created BrowserLoginResponse`);

        // set the claims we received, set userId in session and redirect
        session!.browserResponse = output;

        // redirect
        res.redirect("/openid/loggedin");
    } catch (err) {
        return next(new HttpException(417, `Unable to perform callback (${err}`, err))
    }
})

/**
 * After logging in the user is redirected to this URL.
 */
router.get("/loggedin", ({ res }) => {
    return res!.render("loggedin", Object.assign({}, buildBaseHandlebarsContext()));
})

export default router;
