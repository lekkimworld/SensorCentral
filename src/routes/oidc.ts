import express from "express";
import * as oidc from "openid-client";
import { getOidcConfig, getOidcEndpoint } from "../oidc-authentication-utils";
import { HttpException, LoginSource } from "../types";
import { CreateLoginUserInput, IdentityService } from "../services/identity-service";
import { lookupService } from "../configure-services";
import { buildBaseHandlebarsContext } from "../utils";
import { Logger } from "../logger";

type OidcClaims = {
    fn: string;
    ln: string;
    email: string | undefined;
    sub: string;
}

const logger = new Logger("oidc");
const router = express.Router();

router.get("/callback/:provider", async (req, res, next) => {
    const session = req.session;
    const nonce = session!.nonce;
    const codeVerifier = session!.codeVerifier;
    if (!nonce) return next(new HttpException(417, `No nonce found (<${nonce}>)`));

    try {
        const oidcEndpoint = getOidcEndpoint(req.params.provider as string);
        let oidcClaims: OidcClaims | undefined;

        switch (oidcEndpoint.loginSource) {
            case LoginSource.google:
            case LoginSource.microsoft:
            case LoginSource.local:
                const config = await getOidcConfig(req.params.provider as string);
                const currentUrl = new URL(`${req.protocol}://${req.get("host")}${req.originalUrl}`);

                const tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
                    pkceCodeVerifier: codeVerifier,
                    expectedNonce: nonce,
                });

                const claims = tokens.claims()!;
                logger.debug(`Retrieved ${req.params.provider} OIDC claims (${JSON.stringify(claims)})`);

                oidcClaims = {
                    sub: claims.sub as string,
                    email: claims.email as string,
                    ln: claims.family_name as string,
                    fn: claims.given_name as string,
                };
                break;

            case LoginSource.github:
                logger.debug("Exchanging GitHub OIDC code for access_token");
                const code = new URL(`${req.protocol}://${req.get("host")}${req.originalUrl}`).searchParams.get("code");
                let resp = await fetch(oidcEndpoint.tokenEndpoint!, {
                    method: "POST",
                    body: `client_id=${oidcEndpoint.clientId}&client_secret=${oidcEndpoint.clientSecret}&redirect_uri=${oidcEndpoint.redirectUri}&code=${code}&code_verifier=${codeVerifier}`,
                    headers: {
                        "content-type": "application/x-www-form-urlencoded",
                        accept: "application/json",
                    },
                });
                if (!resp.ok)
                    throw new HttpException(417, "Unable to exchange Github authorization code");
                const body = await resp.json() as any;
                logger.debug(`Received GitHub access_token for user - getting userinfo`);
                resp = await fetch(oidcEndpoint.userinfoEndpoint!, {
                    headers: {
                        accept: "application/json",
                        authorization: `Bearer ${body.access_token}`,
                    },
                });
                if (!resp.ok)
                    throw new HttpException(417, "Unable to get Github userinfo by access_token");

                const userinfo = await resp.json() as any;
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

        const identService = await lookupService(IdentityService.NAME) as IdentityService;

        if (session.oidc_add && session.oidc_userid) {
            await identService.addOidcMapping(session.oidc_userid, oidcClaims!.sub, oidcEndpoint.loginSource);
            delete session.oidc_add;
            delete session.oidc_userid;
            session.save();
            return res.redirect("/");
        }

        const output = await identService.getOrCreateBrowserLoginResponse({
            source: oidcEndpoint.loginSource,
            oidc_sub: oidcClaims!.sub,
            email: oidcClaims!.email,
            ln: oidcClaims!.ln,
            fn: oidcClaims!.fn,
        } as CreateLoginUserInput);
        logger.debug(`Created BrowserLoginResponse`);

        session!.browserResponse = output;
        res.redirect("/openid/loggedin");
    } catch (err) {
        return next(new HttpException(417, `Unable to perform callback (${err}`, err))
    }
})

router.get("/loggedin", ({ res }) => {
    return res!.render("loggedin", Object.assign({}, buildBaseHandlebarsContext()));
})

export default router;
