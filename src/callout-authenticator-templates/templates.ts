import { CalloutAuthenticatorTemplate } from "../types";
import staticBearerToken from "./static-bearertoken";
import datacloudClientCredentials from "./datacloud-clientcredentials-oauth";
import datacloudAnonWebSDK from "./datacloud-anonymous-websdk";

export const templates : Record<string, CalloutAuthenticatorTemplate> = {
    "static-bearertoken": {
        name: "Static Bearer Token",
        placeholders: {
            "token": "This is the token to use"
        },
        executor: staticBearerToken
    },
    "datacloud-clientcredentials": {
        name: "Salesforce Data Cloud clientcredentials OAuth Flow",
        placeholders: {
            "client_id": "The client_id (consumer key) as configured in Salesforce",
            "client_secret": "The client_secret (consumer secret) as configured in Salesforce"
        },
        executor: datacloudClientCredentials
    },
    "datacloud-websdk": {
        name: "Salesforce Data Cloud WebSDK",
        placeholders: {
            "app_source_id": "The app source id as supplied in the connector setup",
            "device_id": "The device id to use when authenticating"
        },
        executor: datacloudAnonWebSDK
    }
} as const;
