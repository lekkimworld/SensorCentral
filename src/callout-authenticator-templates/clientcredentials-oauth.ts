import { CalloutAuthenticatorTemplateExecutor, CalloutEndpoint, CalloutSecret } from "../types";
import CalloutService, { MIMETYPE_FORM, MIMETYPE_JSON } from "../services/callout-service";
import getService from "../services/service-locator";
import Handlebars from "handlebars";

type OAuthTokenResponse = {
    access_token: string;
    token_type: string;
    expires_in: number;
}

const authenticator: CalloutAuthenticatorTemplateExecutor = async (templateMappings: Record<string, CalloutSecret>, endpoint: CalloutEndpoint): Promise<Record<string, string>> => {
    const payloadTemplate = `grant_type=client_credentials&client_id={{client_id}}&client_secret={{client_secret}}`;

    const ctx = {
        client_id: templateMappings["client_id"]?.value,
        client_secret: templateMappings["client_secret"]?.value,
    };
    if (!ctx.client_id || !ctx.client_secret) {
        throw new Error(`Missing client_id or client_secret for OAuth client_credentials flow`);
    }

    const body = Handlebars.compile(payloadTemplate)(ctx);
    const calloutSvc = getService<CalloutService>(CalloutService.NAME);

    const resp = await calloutSvc.request<OAuthTokenResponse>({
        method: "POST",
        headers: {
            "content-type": MIMETYPE_FORM,
            "accept": MIMETYPE_JSON,
        },
        body,
        url: `${endpoint.baseUrl}/oauth/token`,
    });

    return {
        "Authorization": `Bearer ${resp.access_token}`,
    };
};
export default authenticator;
