import { Issuer, generators, custom } from "openid-client";
import { Logger } from "./logger";

const logger = new Logger("oidc-authentication-utils");

// extend timeout if running against dummy OIDC provider
if (process.env.OIDC_POST_CLIENT_SECRET) {
    logger.info("Extending HTTP Timeout for OIDC Discovery");
    custom.setHttpOptionsDefaults({
        "timeout": 150000
    });
}

// build OpenID client
export const getOidcClient = async () => {
    // discover issuer
    const oidcIssuer = await Issuer.discover(process.env.OIDC_PROVIDER_URL as string);

    // create client
    const client = new oidcIssuer.Client({
        "client_id": process.env.OIDC_CLIENT_ID as string,
        "client_secret": process.env.OIDC_CLIENT_SECRET as string,
        "redirect_uris": [process.env.OIDC_REDIRECT_URI as string],
        "response_types": ["code"]
    })
    return client;
}

/**
 * Browser payload when browser is asking for a OpenID Connect Provider 
 * login url.
 * 
 */
export interface AuthenticationUrlPayload {
    url : string;
}

/**
 * Derivative of AuthenticationUrlPayload to extend with the nonce 
 * used during the OpenID Connect authentication flow.
 */
export interface AuthenticationUrlWithNonce extends AuthenticationUrlPayload {
    nonce : string;
}

export const getAuthenticationUrl = async () => {
    // generate nonce and auth url
    const nonce = generators.nonce();

    // get client
    const client = await getOidcClient();

    // get auth URL
    let url = client.authorizationUrl({
        "scope": process.env.GOOGLE_SCOPES || "openid email profile",
        "nonce": nonce
    });

    // redirect
    if (process.env.GOOGLE_HOSTED_DOMAIN) {
        url = `${url}&hd=${process.env.GOOGLE_HOSTED_DOMAIN}`;
    }
    return {
        "url": url,
        "nonce": nonce
    } as AuthenticationUrlWithNonce;
}

