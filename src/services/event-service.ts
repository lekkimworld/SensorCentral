import Handlebars from "handlebars";
import constants from "../constants";
import { BackendIdentity, BaseService, HttpMethod, OnSensorSampleEvent, TopicSensorMessage, Endpoint, Sensor } from "../types";
import { Logger } from "../logger";
import { PubsubService } from "./pubsub-service";
import { ISubscriptionResult } from "../configure-queues-topics";
import { StorageService } from "./storage-service";
import { IdentityService } from "./identity-service";

const logger = new Logger("event-service");
const MIMETYPE_JSON = "application/json";

type RequestData = {
    /**
     * Event id
     */
    id: string;

    endpoint: Endpoint,
    body: string | undefined,
    path: string,
    url: string
}

type TemplateContext = {
    id: string;
    value: number;
    sensor: Sensor;
}

export class EventService extends BaseService {
    public static NAME = "event";
    private storage!: StorageService;
    private identity!: BackendIdentity;

    constructor() {
        super(EventService.NAME);
        this.dependencies = [PubsubService.NAME, StorageService.NAME, IdentityService.NAME];
    }

    async init(callback: (err?: Error) => {}, services: BaseService[]) {
        const pubsub = services[0] as PubsubService;
        this.storage = services[1] as StorageService;
        this.identity = (services[2] as IdentityService).getServiceBackendIdentity(EventService.NAME);

        // listen for known sensor messages
        pubsub.subscribeTopic(constants.TOPICS.SENSOR, "known.#", this.sensorTopicMessages.bind(this));

        // callback
        logger.info("Initialized event-service");
        callback();
    }

    private async sensorTopicMessages(result: ISubscriptionResult) {
        // get msg and log
        const msg = result.data as TopicSensorMessage;
        logger.debug(
            `Received message on ${result.exchangeName} / ${result.routingKey} for sensor id <${msg.sensorId}> value <${msg.value}>`
        );

        // get events defined for this sensor (across users)
        const events = await this.storage.getAllOnSensorSampleEvents(this.identity, msg.sensorId);
        logger.info(`Found <${events.length}> onSensorSample event definitions for sensor <${msg.sensorId}> after receiving event`);

        // loop
        events.forEach(async (ev) => {
            try {
                await this.processEventDefinition(ev, msg);
            } catch (err) {
                logger.error(`Unable to process event definition for id <${ev.id}>: ${err.message}`);
            }
        });
    }

    private substituteFromContext(id: string, template: string|undefined, ctx: TemplateContext) : string|undefined {
        if (!template) return undefined;

        let result = template;
        logger.trace(`Event definition <${id}> has result <${result}> - substututing keys`);
        let idx1 = 0;
        let idx2 = 0;
        let replacement = "{{";
        while ((idx1 = result.indexOf("%%", idx2)) >= 0) {
            result = `${result.substring(0, idx1)}${replacement}${result.substring(idx1 + 2)}`;
            idx2 = idx1 + 2;
            replacement = replacement === "{{" ? "}}" : "{{";
        }
        logger.trace(`Event definition <${id}> - after compiling template <${template}> with context <${JSON.stringify(ctx)}>`);
        const body = Handlebars.compile(result)(ctx);
        logger.trace(`Event definition <${id}> - after substitution the result is <${body}>`);
        return body;
    }

    private async processEventDefinition(ev: OnSensorSampleEvent, msg: TopicSensorMessage) : Promise<void> {
        logger.debug(`Event definition <${ev.id}> for sensor id <${msg.sensorId}> - starting to process`);

        // build context
        const sensor = await this.storage.getSensor(this.identity, msg.sensorId);
        const ctx = {
            id: msg.sensorId,
            value: msg.value,
            sensor
        };

        // replace in body if any
        const body = this.substituteFromContext(ev.id, ev.bodyTemplate, ctx);
        const path = this.substituteFromContext(ev.id, ev.path, ctx);
        const requestData : RequestData = {
            id: ev.id,
            endpoint: ev.endpoint,
            url: `${ev.endpoint.baseUrl}${path}`,
            path: path!,
            body
        };

        // look at method and forward call
        if (ev.method === HttpMethod.POST) {
            await this.processEventDefinitionPOST(requestData);
        } else if (ev.method === HttpMethod.GET) {
            await this.processEventDefinitionGET(requestData);
        }
    }

    private async processEventDefinitionGET(data: RequestData) : Promise<void> {
        logger.debug(`Event definition <${data.id}> - sending GET request to <${data.url}>`);
        const resp = await fetch(data.url, {
            method: "GET",
            headers: {
                authorization: `Bearer ${data.endpoint.bearerToken}`,
                accept: MIMETYPE_JSON,
            },
        });

        if (resp.status < 300 && resp.status >= 200) {
            logger.debug(`Received success response - status <${resp.status}>`);
        } else {
            throw new Error(
                `Unexpected status <${resp.status}> (${resp.statusText}) returned from endpoint (${await resp.text()})`
            );
        }
        const result = await resp.json();
        logger.debug(`Event definition <${data.id}> result <${JSON.stringify(result)}>`);
    }

    private async processEventDefinitionPOST(data: RequestData) : Promise<void> {
        logger.debug(`Event definition <${data.id}> - sending POST request to <${data.url}> with body <${data.body}>`);
        const resp = await fetch(data.url, {
            method: "POST",
            body: data.body,
            headers: {
                "content-type": MIMETYPE_JSON,
                "authorization": `Bearer ${data.endpoint.bearerToken}`,
                "accept": MIMETYPE_JSON
            }
        })
        
        if (resp.status < 300 && resp.status >= 200) {
            logger.debug(`Received success response - status <${resp.status}>`);
        } else {
            throw new Error(`Unexpected status <${resp.status}> (${resp.statusText}) returned from endpoint (${await resp.text()})`);
        }
        const result = await resp.json();
        logger.debug(`Event definition <${data.id}> result <${JSON.stringify(result)}>`);
    }
}