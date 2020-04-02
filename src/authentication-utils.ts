import { Issuer, generators } from "openid-client";
import express from "express-session";

// build OpenID client
const oidcIssuerPromise = Issuer.discover(process.env.OIDC_PROVIDER_URL as string).then(oidcIssuer => {
    // create client
    const client = new oidcIssuer.Client({
        "client_id": process.env.OIDC_CLIENT_ID as string,
        "client_secret": process.env.OIDC_CLIENT_SECRET as string,
        "redirect_uris": [process.env.OIDC_REDIRECT_URI as string],
        "response_types": ["code"]
    })
    return Promise.resolve(client);
});

export interface AuthenticationParameters {
    nonce : string;
    url : string;
}
export const authenticationUrl = () => {
    // generate nonce and auth url
    const nonce = generators.nonce();
    return oidcIssuerPromise.then(client => {
        // get auth URL
        let url = client.authorizationUrl({
            "scope": process.env.GOOGLE_SCOPES || "openid email profile",
            "nonce": nonce
        });

        // redirect
        if (process.env.GOOGLE_HOSTED_DOMAIN) {
            url = `${url}&hd=${process.env.GOOGLE_HOSTED_DOMAIN}`;
        }
        return Promise.resolve({
            "url": url,
            "nonce": nonce
        }) as Promise<AuthenticationParameters>;
    });
}

