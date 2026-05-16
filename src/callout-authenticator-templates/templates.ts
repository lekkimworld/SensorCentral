import { CalloutAuthenticatorTemplate } from "../types";
import staticBearerToken from "./static-bearertoken";
import datacloudClientCredentials from "./datacloud-clientcredentials-oauth";
import datacloudAnonWebSDK from "./datacloud-anonymous-websdk";
import clientCredentials from "./clientcredentials-oauth";

export const DATACLOUD_CLIENTCREDENTIALS = "DATACLOUD_CLIENTCREDENTIALS";
export const STATIC_BEARERTOKEN = "STATIC_BEARERTOKEN";
export const DATACLOUD_WEBSDK = "DATACLOUD_WEBSDK";
export const CLIENTCREDENTIALS_OAUTH = "CLIENTCREDENTIALS_OAUTH";
export enum AuthenticatorTemplate {
    "DATACLOUD_CLIENTCREDENTIALS" = "DATACLOUD_CLIENTCREDENTIALS",
    "STATIC_BEARERTOKEN" = "STATIC_BEARERTOKEN",
    "DATACLOUD_WEBSDK" = "DATACLOUD_WEBSDK",
    "CLIENTCREDENTIALS_OAUTH" = "CLIENTCREDENTIALS_OAUTH"
}

export const templates : Record<AuthenticatorTemplate, CalloutAuthenticatorTemplate> = {
    "STATIC_BEARERTOKEN": {
        id: "STATIC_BEARERTOKEN",
        name: "Static Bearer Token",
        placeholders: {
            "token": "This is the token to use"
        },
        executor: staticBearerToken
    },
    "DATACLOUD_CLIENTCREDENTIALS" : {
        id: "DATACLOUD_CLIENTCREDENTIALS",
        name: "Salesforce Data Cloud clientcredentials OAuth Flow",
        placeholders: {
            "client_id": "The client_id (consumer key) as configured in Salesforce",
            "client_secret": "The client_secret (consumer secret) as configured in Salesforce"
        },
        executor: datacloudClientCredentials
    },
    "DATACLOUD_WEBSDK": {
        id: "DATACLOUD_WEBSDK",
        name: "Salesforce Data Cloud WebSDK",
        placeholders: {
            "app_source_id": "The app source id as supplied in the connector setup",
            "device_id": "The device id to use when authenticating"
        },
        executor: datacloudAnonWebSDK
    },
    "CLIENTCREDENTIALS_OAUTH": {
        id: "CLIENTCREDENTIALS_OAUTH",
        name: "OAuth client_credentials",
        placeholders: {
            "client_id": "The OAuth client ID",
            "client_secret": "The OAuth client secret"
        },
        executor: clientCredentials
    }
} as const;
