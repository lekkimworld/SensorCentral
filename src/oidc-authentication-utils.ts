import * as client from "openid-client";
import { Logger } from "./logger";
import { LoginSource } from "./types";

const logger = new Logger("oidc-authentication-utils");

const PROVIDER_ENV_KEYS: Record<string, string[]> = {
    [LoginSource.google]: ["OIDC_CLIENT_ID_GOOGLE", "OIDC_CLIENT_SECRET_GOOGLE", "OIDC_PROVIDER_URL_GOOGLE", "OIDC_REDIRECT_URI_GOOGLE"],
    [LoginSource.github]: ["OIDC_CLIENT_ID_GITHUB", "OIDC_CLIENT_SECRET_GITHUB", "OIDC_REDIRECT_URI_GITHUB"],
    [LoginSource.microsoft]: ["OIDC_CLIENT_ID_MICROSOFT", "OIDC_CLIENT_SECRET_MICROSOFT", "OIDC_PROVIDER_URL_MICROSOFT", "OIDC_REDIRECT_URI_MICROSOFT"],
    [LoginSource.local]: ["OIDC_CLIENT_ID_LOCAL", "OIDC_CLIENT_SECRET_LOCAL", "OIDC_PROVIDER_URL_LOCAL", "OIDC_REDIRECT_URI_LOCAL"],
};

export const getConfiguredProviders = (): string[] => {
    return Object.entries(PROVIDER_ENV_KEYS)
        .filter(([_, keys]) => keys.every(k => !!process.env[k]))
        .map(([provider]) => provider);
};

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

        case LoginSource.local:
            return {
                loginSource: LoginSource.local,
                userinfoEndpoint: undefined,
                authorizationEndpoint: undefined,
                tokenEndpoint: undefined,
                providerUrl: process.env.OIDC_PROVIDER_URL_LOCAL as string,
                clientId: process.env.OIDC_CLIENT_ID_LOCAL as string,
                clientSecret: process.env.OIDC_CLIENT_SECRET_LOCAL as string,
                redirectUri: process.env.OIDC_REDIRECT_URI_LOCAL as string,
                scopes: "openid email profile",
            };

        default:
            throw new Error(`Supplied provider (${provider}) is not supported`);
    }
}

const configCache = new Map<string, client.Configuration>();

export const getOidcConfig = async (provider: string): Promise<client.Configuration> => {
    if (configCache.has(provider)) {
        return configCache.get(provider)!;
    }

    const oidcEndpoint = getOidcEndpoint(provider);
    let config: client.Configuration;

    switch (provider) {
        case LoginSource.google:
        case LoginSource.microsoft:
            config = await client.discovery(
                new URL(oidcEndpoint.providerUrl),
                oidcEndpoint.clientId,
                oidcEndpoint.clientSecret
            );
            break;
        case LoginSource.github:
        case LoginSource.local:
            config = await client.discovery(
                new URL(oidcEndpoint.providerUrl),
                oidcEndpoint.clientId,
                oidcEndpoint.clientSecret,
                undefined,
                {
                    execute: [client.allowInsecureRequests],
                }
            );
            break;
        default:
            throw new Error(`Supplied provider (${provider}) is not supported`);
    }

    configCache.set(provider, config);
    return config;
}

export interface AuthenticationUrlPayload {
    provider: string;
    url : string;
}

export interface AuthenticationUrlWithNonce extends AuthenticationUrlPayload {
    nonce : string;
    codeVerifier: string;
}

export const getAuthenticationUrl = async (provider: string) => {
    const nonce = client.randomNonce();
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);

    const config = await getOidcConfig(provider);
    const oidcEndpoint = getOidcEndpoint(provider);

    const parameters: Record<string, string> = {
        scope: oidcEndpoint.scopes,
        nonce,
        redirect_uri: oidcEndpoint.redirectUri,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
    };

    const redirectTo = client.buildAuthorizationUrl(config, parameters);

    return {
        provider,
        url: redirectTo.href,
        nonce,
        codeVerifier,
    } as AuthenticationUrlWithNonce;
}
