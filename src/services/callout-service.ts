import Handlebars from "handlebars";
import { Logger } from "../logger";
import { BackendIdentity, BaseService, Callout, InitCallback, CalloutSecret, HttpMethod } from "../types";
import { StorageService } from "./storage-service";
import { templates } from "../callout-authenticator-templates/templates";
import { IdentityService } from "./identity-service";
import constants from "../constants";

const logger = new Logger("callout-service");

export const MIMETYPE_TEXT = "text/plain";
export const MIMETYPE_FORM = "application/x-www-form-urlencoded";
export const MIMETYPE_JSON = "application/json";


/**
 * Represents the actual request to be made.
 *
 */
export type RequestData = {
    url: string;
    method: "GET" | "POST" | "PUT" | "DELETE",
    body?: string | undefined,
    headers: Record<string,string>
}

export type CalloutResult<T> = {
    result: T;
    request: { method: string; url: string; body?: string; headers: Record<string, string> };
    response: { status: number; body: string };
}

class CalloutService extends BaseService {
    public static NAME = "callout";
    private storage: StorageService;
    private identity: IdentityService;
    
    constructor() {
        super(CalloutService.NAME);
        this.dependencies = [StorageService.NAME, IdentityService.NAME];
    }

    init(callback: InitCallback, services: BaseService[]): void {
        logger.info("Initialized CalloutService");
        this.storage = services[0] as StorageService;
        this.identity = services[1] as IdentityService;
        callback();
    }

    public async calloutById<T>(user: BackendIdentity, calloutId: string, ctx: any | undefined, extraHeaders?: Record<string,string>) : Promise<T> {
        // get a service identity and impersonate the caller so we can get secrets
        const svcIdentity = this.identity.getServiceBackendIdentity(CalloutService.NAME);
        const impUser = user.identity.callerId === "*" ? user : this.identity.getImpersonationIdentity(svcIdentity, user.identity.callerId);

        // get callout
        const callout = await this.storage.getUserCallout(impUser, calloutId);
        if (!callout) throw new Error(`Unable to find callout with id <${calloutId}> for user`);
        if (extraHeaders) {
            callout.headers = Object.assign({}, callout.headers, extraHeaders);
        }
        return this.callout(user, callout, ctx);
    }

    public async calloutByIdWithDetails(user: BackendIdentity, calloutId: string, ctx: any | undefined): Promise<CalloutResult<any>> {
        const svcIdentity = this.identity.getServiceBackendIdentity(CalloutService.NAME);
        const impUser = user.identity.callerId === "*" ? user : this.identity.getImpersonationIdentity(svcIdentity, user.identity.callerId);

        const callout = await this.storage.getUserCallout(impUser, calloutId);
        if (!callout) throw new Error(`Unable to find callout with id <${calloutId}> for user`);
        return this.calloutWithDetails(user, callout, ctx);
    }

    private buildSecretsLookup(secrets: CalloutSecret[]): Record<string, string> {
        const lookup: Record<string, string> = {};
        secrets.forEach(s => { lookup[s.name.toLowerCase().replace(/ /g, "_")] = s.value; });
        return lookup;
    }

    private async prepareCallout(user: BackendIdentity, c: Callout, ctx: any | undefined): Promise<RequestData> {
        const svcIdentity = this.identity.getServiceBackendIdentity(CalloutService.NAME);
        const impUser = user.identity.callerId === "*" ? user : this.identity.getImpersonationIdentity(svcIdentity, user.identity.callerId);

        const headers: Record<string, string> = {};
        const secrets = await this.storage.getUserCalloutSecrets(impUser);

        if (c.authenticator) {
            const authTempl = templates[c.authenticator.template];
            const templateMappings: Record<string, CalloutSecret> = {};
            Object.keys(authTempl.placeholders).forEach(keyReplacement => {
                const secret = c.authenticator!.templateMappings[keyReplacement];
                if (!secret) throw new Error(`Unable to find required secret for authenticator <${keyReplacement}>`);
                templateMappings[keyReplacement] = secret;
            });
            if (authTempl.optionalPlaceholders) {
                Object.keys(authTempl.optionalPlaceholders).forEach(keyReplacement => {
                    const secret = c.authenticator!.templateMappings[keyReplacement];
                    if (secret) templateMappings[keyReplacement] = secret;
                });
            }
            const authHeaders = await authTempl.executor(templateMappings, c.authenticator.endpoint);
            Object.keys(authHeaders).forEach(key => headers[key] = authHeaders[key]);
        }

        if (c.headers) {
            Object.keys(c.headers).forEach(key => headers[key] = c.headers![key]);
        }
        if (c.contentType) {
            headers["content-type"] = c.contentType;
        }

        const protocol = constants.APP.PROTOCOL;
        const domain = constants.APP.DOMAIN || "localhost";
        const app = { protocol, hostname: domain, url: `${protocol}://${domain}` };
        const templateCtx = Object.assign({}, ctx, { secrets: this.buildSecretsLookup(secrets), app });

        let body: string | undefined = undefined;
        if (c.bodyTemplate && ctx) {
            body = Handlebars.compile(c.bodyTemplate)(templateCtx);
        } else if (c.bodyTemplate) {
            body = c.bodyTemplate;
        }

        const path = Handlebars.compile(c.pathTemplate)(templateCtx);
        const url = `${c.endpoint.baseUrl}${path}`;

        return {
            method: c.method === "GET" ? HttpMethod.GET : c.method === "POST" ? HttpMethod.POST : c.method === "PUT" ? HttpMethod.PUT : HttpMethod.DELETE,
            url,
            body,
            headers
        };
    }

    public async calloutWithDetails(user: BackendIdentity, c: Callout, ctx: any | undefined): Promise<CalloutResult<any>> {
        const req = await this.prepareCallout(user, c, ctx);
        return this.requestWithDetails<any>(req);
    }

    public async callout<T>(user: BackendIdentity, c: Callout, ctx: any | undefined) : Promise<T> {
        const req = await this.prepareCallout(user, c, ctx);
        const resp = await this.request<T>(req);

        // return
        return resp;
    }

    public async request<T>(req: RequestData) : Promise<T> {
        const result = await this.requestWithDetails<T>(req);
        return result.result;
    }

    public async requestWithDetails<T>(req: RequestData) : Promise<CalloutResult<T>> {
        let jsonResponse = false;

        const headers : Record<string,string> = {};
        Object.keys(req.headers).forEach(key => {
            const value = req.headers[key];
            if ("accept" === key.toLowerCase()) {
                jsonResponse = (value === MIMETYPE_JSON);
            }
            headers[key] = value;
        })

        headers["user-agent"] = `${constants.APP.NAME} CalloutService/${constants.APP.VERSION} (${constants.APP.GITCOMMIT})`;

        const requestInfo : RequestInit = {
            method: req.method,
            headers
        };
        if (["PUT", "POST"].includes(req.method)) {
            requestInfo.body = req.body || "";
        }

        try {
            const resp = await fetch(req.url, requestInfo);

            if (!resp.ok) {
                const errorBody = await resp.text().catch(() => "");
                throw new Error(`Non-ok response code <${resp.status}> / <${resp.statusText}>\n${errorBody}`);
            }

            let result: T;
            let responseBody: string;
            if (jsonResponse) {
                responseBody = await resp.text();
                result = JSON.parse(responseBody) as T;
            } else {
                responseBody = await resp.text();
                result = responseBody as any;
            }

            return {
                result,
                request: { method: req.method, url: req.url, body: req.body, headers },
                response: { status: resp.status, body: responseBody },
            };
        } catch (err) {
            throw new Error(`Caught error making request to <${req.url}> (${err.message})`);
        }
    }
    public async testAuthenticator(user: BackendIdentity, authenticatorId: string): Promise<{ success: boolean; message: string }> {
        const svcIdentity = this.identity.getServiceBackendIdentity(CalloutService.NAME);
        const impUser = user.identity.callerId === "*" ? user : this.identity.getImpersonationIdentity(svcIdentity, user.identity.callerId);

        try {
            const authenticators = await this.storage.getCalloutAuthenticators(impUser);
            const auth = authenticators.find(a => a.id === authenticatorId);
            if (!auth) return { success: false, message: "Authenticator not found" };

            const authTempl = templates[auth.template];
            if (!authTempl) return { success: false, message: `Unknown template: ${auth.template}` };

            const templateMappings: Record<string, any> = {};
            for (const key of Object.keys(authTempl.placeholders)) {
                const secret = auth.templateMappings[key];
                if (!secret) return { success: false, message: `Missing secret mapping for placeholder "${key}"` };
                templateMappings[key] = secret;
            }

            const headers = await authTempl.executor(templateMappings, auth.endpoint);
            const details = Object.keys(headers).map(k => `${k}: ${headers[k]}`).join("\n");
            return { success: true, message: `Authentication successful.\n\n${details}` };
        } catch (err: any) {
            return { success: false, message: err.message || String(err) };
        }
    }

    public async testCallout(user: BackendIdentity, calloutId: string): Promise<{ success: boolean; message: string }> {
        const testCtx = {
            targetId: "test-000-000",
            triggerType: "manual_test",
            timestamp: new Date().toISOString(),
        };
        try {
            const result = await this.calloutById<any>(user, calloutId, testCtx);
            const body = typeof result === "string" ? result : JSON.stringify(result, null, 2);
            return { success: true, message: `Callout succeeded.\n\n${body}` };
        } catch (err: any) {
            return { success: false, message: err.message || String(err) };
        }
    }
}
export default CalloutService;
