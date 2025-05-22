import { CalloutAuthenticatorTemplateExecutor, Endpoint, Secret } from "../types";

const authenticator : CalloutAuthenticatorTemplateExecutor = async (secrets: Array<Secret>, templateMappings: Record<string,string>, _endpoint: Endpoint) : Promise<Record<string,string>> => {
    // get the token to use from secrets
    const token = secrets.find(s => s.name === templateMappings["token"])?.value;
    if (!token) throw new Error(`Unable to find secret for executor - should have a valid mapping from <token> to <${templateMappings["token"]}>`);
    return {
        "Authorization": `Bearer ${token}`
    }
}
export default authenticator;
