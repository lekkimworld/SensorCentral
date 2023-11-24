import { Issuer, IssuerMetadata, generators, custom, Client } from "openid-client";
import { Logger } from "./logger";
import { LoginSource } from "./types";

const logger = new Logger("oidc-authentication-utils");

// extend timeout if running against dummy OIDC provider
if (process.env.OIDC_POST_CLIENT_SECRET) {
    logger.info("Extending HTTP Timeout for OIDC Discovery");
    custom.setHttpOptionsDefaults({
        "timeout": 150000
    });
}

export type OidcEndpoint = {
    loginSource: LoginSource; 
    providerUrl : string;
    clientId : string;
    clientSecret : string;
    redirectUri : string;
    scopes: string;
    userinfoEndpoint: string | undefined;
    authorizationEndpoint: string | undefined;
    tokenEndpoint: string | undefined;
}

/**
 * Returns provider specific OIDC endpoint information. Throws an error if an 
 * unsupported provider is supplied.
 * 
 * @param provider 
 * @returns 
 */
export const getOidcEndpoint = (provider: string) : OidcEndpoint => {
    switch (provider) {
        case LoginSource.google:
            return {
                loginSource: LoginSource.google,
                userinfoEndpoint: undefined,
                authorizationEndpoint: undefined,
                tokenEndpoint: undefined,
                providerUrl: process.env.OIDC_PROVIDER_URL_GOOGLE as string,
                clientId: process.env.OIDC_CLIENT_ID_GOOGLE as string,
                clientSecret: process.env.OIDC_CLIENT_SECRET_GOOGLE as string,
                redirectUri: process.env.OIDC_REDIRECT_URI_GOOGLE as string,
                scopes: "openid email profile",
            };

        case LoginSource.microsoft:
            return {
                loginSource: LoginSource.microsoft,
                userinfoEndpoint: undefined,
                authorizationEndpoint: undefined,
                tokenEndpoint: undefined,
                providerUrl: process.env.OIDC_PROVIDER_URL_MICROSOFT as string,
                clientId: process.env.OIDC_CLIENT_ID_MICROSOFT as string,
                clientSecret: process.env.OIDC_CLIENT_SECRET_MICROSOFT as string,
                redirectUri: process.env.OIDC_REDIRECT_URI_MICROSOFT as string,
                scopes: "openid email profile",
            };

        case LoginSource.github:
            return {
                loginSource: LoginSource.github,
                userinfoEndpoint: "https://api.github.com/user",
                authorizationEndpoint: "https://github.com/login/oauth/authorize",
                tokenEndpoint: "https://github.com/login/oauth/access_token",
                providerUrl: process.env.OIDC_PROVIDER_URL_GITHUB as string,
                clientId: process.env.OIDC_CLIENT_ID_GITHUB as string,
                clientSecret: process.env.OIDC_CLIENT_SECRET_GITHUB as string,
                redirectUri: process.env.OIDC_REDIRECT_URI_GITHUB as string,
                scopes: "read:user user:email",
            };

        default:
            throw new Error(`Supplied provider (${provider}) is not supported`);
    }
}

// build OpenID client
export const getOidcClient = async (provider: string) => {
    // get data for provider
    let oidcIssuer : Issuer<Client> | undefined;
    const oidcEndpoint = getOidcEndpoint(provider);
    switch (provider) {
        case LoginSource.google:
        case LoginSource.microsoft:
            oidcIssuer = await Issuer.discover(oidcEndpoint.providerUrl);
            break;
        case LoginSource.github:
            oidcIssuer = new Issuer({
                issuer: "GitHub",
                authorization_endpoint: oidcEndpoint.authorizationEndpoint,
                token_endpoint: oidcEndpoint.tokenEndpoint,
                userinfo_endpoint: oidcEndpoint.userinfoEndpoint,
            } as IssuerMetadata);
            break;
        default:
            throw new Error(`Supplied provider (${provider}) is not supported`);
    }

    // create client
    const client = new oidcIssuer!.Client({
        "client_id": oidcEndpoint.clientId,
        "client_secret": oidcEndpoint.clientSecret,
        "redirect_uris": [oidcEndpoint.redirectUri],
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
    provider: string;
    url : string;
}

/**
 * Derivative of AuthenticationUrlPayload to extend with the nonce 
 * used during the OpenID Connect authentication flow.
 */
export interface AuthenticationUrlWithNonce extends AuthenticationUrlPayload {
    nonce : string;
}

export const getAuthenticationUrl = async (provider: string) => {
    // generate nonce and auth url
    const nonce = generators.nonce();

    // get client
    const client = await getOidcClient(provider);
    const oidcEndpoint = getOidcEndpoint(provider);

    // get auth URL
    let url = client.authorizationUrl({
        "scope": oidcEndpoint.scopes,
        "nonce": nonce
    });

    return {
        provider,
        "url": url,
        "nonce": nonce
    } as AuthenticationUrlWithNonce;
}

