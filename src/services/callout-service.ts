import Handlebars from "handlebars";
import fetch, { RequestInit } from "node-fetch";
import { Logger } from "../logger";
import { BackendIdentity, BaseService, Callout, InitCallback } from "../types";
import { StorageService } from "./storage-service";

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
    method: "GET" | "POST" | "PUT",
    body?: string | undefined,
    headers: Record<string,string>
}

class CalloutService extends BaseService {
    public static NAME = "callout";
    private storage: StorageService;
    
    constructor() {
        super(CalloutService.NAME);
        this.dependencies = [StorageService.NAME];
    }

    init(callback: InitCallback, services: BaseService[]): void {
        logger.info("Initialized CalloutService");
        this.storage = services[0] as StorageService;
        callback();
    }

    public async callout<T>(user: BackendIdentity, c: Callout, ctx: any | undefined) : Promise<T> {
        // define headers
        const headers : Record<string,string> = {};

        // get secrets for user
        const secrets = await this.storage.getUserSecrets(user);

        // execute the authenticator if supplied
        if (c.authenticator) {
            const authTempl = c.authenticator.template;
            const authHeaders = await authTempl.executor(secrets, c.authenticator.templateMappings, c.authenticator.endpoint);
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
            method: c.method,
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
                const obj = await resp.json();
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
