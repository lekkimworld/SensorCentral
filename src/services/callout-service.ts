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

    public async callout<T>(user: BackendIdentity, c: Callout, ctx: any | undefined) : Promise<T> {
        // get a service identity and impersonate the caller so we can get secrets
        const svcIdentity = this.identity.getServiceBackendIdentity(CalloutService.NAME);
        const impUser = user.identity.callerId === "*" ? user : this.identity.getImpersonationIdentity(svcIdentity, user.identity.callerId);

        // define headers
        const headers : Record<string,string> = {};

        // get secrets for user
        const secrets = await this.storage.getUserCalloutSecrets(impUser);

        // execute the authenticator if supplied
        if (c.authenticator) {
            // get actual template
            const authTempl = templates[c.authenticator.template];

            // map required replacements to secrets
            const templateMappings : Record<string,CalloutSecret> = {};
            Object.keys(authTempl.placeholders).forEach(keyReplacement => {
                // get the secret to replace with
                const secret = c.authenticator!.templateMappings[keyReplacement];
                if (!secret) {
                    // unable to find required secret
                    throw new Error(`Unable to find required secret for authenticator <${keyReplacement}>`);
                }
                templateMappings[keyReplacement] = secret;
            })
            
            // run it
            const authHeaders = await authTempl.executor(templateMappings, c.authenticator.endpoint);
            Object.keys(authHeaders).forEach(key => headers[key] = authHeaders[key]);
        }

        // add additional headers
        if (c.headers) {
            // loop the keys
            Object.keys(c.headers).forEach(key => headers[key] = c.headers![key]);
        }

        // compute body
        let body: string | undefined = undefined;
        if (c.bodyTemplate && ctx) {
            body = Handlebars.compile(c.bodyTemplate)(ctx);
        } else if (c.bodyTemplate) {
            body = c.bodyTemplate;
        }

        // compute path and url
        const path = Handlebars.compile(c.pathTemplate)(ctx);
        const url = `${c.endpoint.baseUrl}${path}`;

        // run callout
        const resp = await this.request<T>({
            method: c.method === "GET" ? HttpMethod.GET : c.method === "POST" ? HttpMethod.POST : c.method === "PUT" ? HttpMethod.PUT : HttpMethod.DELETE,
            url,
            body,
            headers
        })

        // return
        return resp;
    }

    public async request<T>(req: RequestData) : Promise<T> {
        // is the accept header set to indicate json?
        let jsonResponse = false;

        // calc headers
        const headers : Record<string,string> = {};
        Object.keys(req.headers).forEach(key => {
            const value = req.headers[key];
            if ("accept" === key.toLowerCase()) {
                jsonResponse = (value === MIMETYPE_JSON);
            }
            headers[key] = value;
        })

        // set useragent
        headers["user-agent"] = `${constants.APP.NAME} CalloutService/${constants.APP.VERSION} (${constants.APP.GITCOMMIT})`;

        // make request info
        const requestInfo : RequestInit = {
            method: req.method,
            headers
        };
        if (["PUT", "POST"].includes(req.method)) {
            requestInfo.body = req.body || "";
        }

        try {
            // make request
            const resp = await fetch(req.url, requestInfo);
            
            // look at response code that it's a 20x
            if (!resp.ok) {
                // reponse is not ok
                throw new Error(`Non-ok response code <${resp.status}> / <${resp.statusText}>`);
            }

            // parse response
            if (jsonResponse) {
                const obj = await resp.json() as T;
                return obj;
            } else {
                const txt = await resp.text();
                return txt as any;
            }

        } catch (err) {
            throw new Error(`Caught error making request to <${req.url}> (${err.message})`);
        }
    }
/*
    private async processEventDefinitionGET(data: RequestData) : Promise<void> {
        logger.debug(`Event definition <${data.id}> - sending GET request to <${data.url}>`);
        const resp = await fetch(data.url, {
            method: "GET",
            headers: Object.assign({}, data.headers, {
                "accept": MIMETYPES["JSON"]
            }),
        });

        if (resp.status < 300 && resp.status >= 200) {
            logger.debug(`Received success response - status <${resp.status}>`);
        } else {
            throw new Error(
                `Unexpected status <${resp.status}> (${resp.statusText}) returned from endpoint (${await resp.text()})`
            );
        }
        const result = await resp.text();
        logger.debug(`Event definition <${data.id}> result <${result}>`);
    }

    private async processEventDefinitionPOST(data: RequestData) : Promise<void> {
        logger.debug(`Event definition <${data.id}> - sending POST request to <${data.url}> with body <${data.body}>`);
        const resp = await fetch(data.url, {
            method: "POST",
            body: data.body,
            headers: Object.assign({}, data.headers, {
                "content-type": data.contentType,
                "accept": MIMETYPES["JSON"],
            }),
        });
        
        if (resp.status < 300 && resp.status >= 200) {
            logger.debug(`Received success response - status <${resp.status}>`);
        } else {
            throw new Error(`Unexpected status <${resp.status}> (${resp.statusText}) returned from endpoint (${await resp.text()})`);
        }
        const result = await resp.text();
        logger.debug(`Event definition <${data.id}> result <${result}>`);
    }
        */
}
export default CalloutService;
