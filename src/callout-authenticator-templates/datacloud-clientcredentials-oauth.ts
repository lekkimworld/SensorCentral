import { CalloutAuthenticatorTemplateExecutor, CalloutEndpoint, CalloutSecret } from "../types";
import CalloutService, { MIMETYPE_FORM, MIMETYPE_JSON } from "../services/callout-service";
import getService from "../services/service-locator";
import Handlebars from "handlebars";

type SalesforceCoreOAuthResponse = {
    access_token: string; 
    signature: string; 
    scope: string;
    instance_url: string;
    id: string;
    token_type: string;
    issued_at: string;
    api_instance_url: string;
}
type SalesforceDataCloudOAuthResponse = {
    access_token: string; 
    instance_url: string;
    token_type: string;
    issued_token_type: string;
    expires_in: number;
}
const authenticator : CalloutAuthenticatorTemplateExecutor = async (templateMappings: Record<string,CalloutSecret>, endpoint: CalloutEndpoint) : Promise<Record<string,string>> => {
    // build clientcredentials payload
    const payloadTemplate = `grant_type=client_credentials&client_id={{client_id}}&client_secret={{client_secret}}`;

    // build context
    const ctx = {
        client_id: templateMappings["client_id"]?.value,
        client_secret: templateMappings["client_secret"]?.value,
    }
    if (!ctx.client_id || !ctx.client_secret) {
        throw new Error(`Unable to find secret for <${templateMappings["client_id"]}> mapped to <client_id> and/or <${templateMappings["client_secret"]}> mapped to <client_secret>`);
    }

    // fill in template
    const coreBody = Handlebars.compile(payloadTemplate)(ctx);

    // get callout service
    const callourSvc = getService<CalloutService>(CalloutService.NAME);

    // get access token from Salesforce core
    const coreResp = await callourSvc.request<SalesforceCoreOAuthResponse>({
        method: "POST",
        headers: {
            "content-type": MIMETYPE_FORM,
            "accept": MIMETYPE_JSON
        },
        body: coreBody,
        url: `${endpoint.baseUrl}/services/oauth2/token`
    });

    // get access token from Data CloudTand
    const dcBody = `grant_type=urn:salesforce:grant-type:external:cdp&subject_token=${coreResp.access_token}&subject_token_type=urn:ietf:params:oauth:token-type:access_token`;
    const dcResp = await callourSvc.request<SalesforceDataCloudOAuthResponse>({
        method: "POST",
        headers: {
            "content-type": MIMETYPE_FORM,
            "accept": MIMETYPE_JSON
        },
        body: dcBody,
        url: `${endpoint.baseUrl}/services/a360/token`
    })

    // get datacloud access token
    const access_token = dcResp.access_token;
    return {
        "Authorization": `Bearer ${access_token}`
    }
}
export default authenticator;
