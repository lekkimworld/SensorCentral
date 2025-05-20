import { Logger } from "../logger";
import { BaseService, ContentType, Endpoint } from "../types";
import { StorageService } from "./storage-service";

const logger = new Logger("callout-service");
/*
const MIMETYPES : Record<ContentType,string> = {
    "JSON": "application/json",
    "FORM": "application/x-www-form-urlencoded/json"
}
*/
/**
 * Represents the actiaæ request to be made.
 * 
 */
export type RequestData = {
    /**
     * Event id
     */
    id: string;

    headers: Record<string,string>,
    endpoint: Endpoint,
    body: string | undefined,
    path: string,
    contentType: ContentType;
    url: string;
}

class CalloutService extends BaseService {
    public static NAME = "callout";
    //private storage: StorageService;
    
    constructor() {
        super(CalloutService.NAME);
        this.dependencies = [StorageService.NAME];
        logger.debug("dkdkd");
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
