import CalloutService, { MIMETYPE_FORM, MIMETYPE_JSON } from "../services/callout-service";
import { CalloutAuthenticatorTemplateExecutor, CalloutEndpoint, CalloutSecret } from "../types";
import getService from "../services/service-locator";

type AuthResponse = {
    jwt: string;
}

export const APP_SOURCE_ID = "app_source_id";
export const DEVICE_ID = "device_id";
const authenticator : CalloutAuthenticatorTemplateExecutor = async (templateMappings: Record<string,CalloutSecret>, endpoint: CalloutEndpoint) : Promise<Record<string,string>> => {
    // build auth payload
    const payloadObj = {
        "appSourceId": templateMappings[APP_SOURCE_ID]?.value,
        "deviceId": templateMappings[APP_SOURCE_ID]?.value
    }
    const authJsonPayloadBase64 = Buffer.from(JSON.stringify(payloadObj)).toString("base64");

    // create body
    const body = `auth=${encodeURIComponent(authJsonPayloadBase64)}`;

    // exchange for jwt
    const calloutSvc = getService<CalloutService>(CalloutService.NAME);
    const obj = await calloutSvc.request<AuthResponse>({
        url: `${endpoint.baseUrl}/web/v2/authentication`,
        method: "POST",
        headers: {
            "content-type": MIMETYPE_FORM,
            "accept": MIMETYPE_JSON
        },
        body
    })
    const jwt = obj.jwt;
    
    // return
    return {
        "Authorization": `Bearer ${jwt}`
    }
}
export default authenticator;
