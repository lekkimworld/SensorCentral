import { CalloutAuthenticatorTemplateExecutor, CalloutEndpoint, CalloutSecret } from "../types";

const authenticator : CalloutAuthenticatorTemplateExecutor = async (templateMappings: Record<string,CalloutSecret>, _endpoint: CalloutEndpoint) : Promise<Record<string,string>> => {
    // get the token to use from secrets
    const token = templateMappings["token"]?.value;
    if (!token) throw new Error(`Unable to find secret for executor - should have a valid mapping from <token> to <${templateMappings["token"]}>`);
    return {
        "Authorization": `Bearer ${token}`
    }
}
export default authenticator;
