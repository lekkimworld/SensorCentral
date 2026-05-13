import moment from "moment-timezone";
import constants from "../constants";
import { Logger } from "../logger";
import { BackendIdentity, BaseService, EventActionType, EventDefinition, EventTriggerType, InitCallback, Sensor, TopicControlMessage, TopicSensorMessage } from "../types";
import { IdentityService } from "./identity-service";
import { PubsubService, TopicMessage } from "./pubsub-service";
import { StorageService } from "./storage-service";

const logger = new Logger("event-service");

export class EventService extends BaseService {
    public static NAME = "event";
    private storage!: StorageService;
    private identity!: BackendIdentity;

    constructor() {
        super(EventService.NAME);
        this.dependencies = [PubsubService.NAME, StorageService.NAME, IdentityService.NAME];
    }

    async init(callback: InitCallback, services: BaseService[]) {
        const pubsub = services[0] as PubsubService;
        this.storage = services[1] as StorageService;
        this.identity = (services[2] as IdentityService).getServiceBackendIdentity(EventService.NAME);

        // listen for sensor data → onSensorSample trigger
        pubsub.subscribe(`${constants.TOPICS.SENSOR}.known.*`, this.onSensorSample.bind(this));

        // listen for timeout events → onSensorTimeout / onDeviceTimeout triggers
        pubsub.subscribe(`${constants.TOPICS.CONTROL}.known.sensor.timeout`, this.onSensorTimeout.bind(this));
        pubsub.subscribe(`${constants.TOPICS.CONTROL}.known.device.timeout`, this.onDeviceTimeout.bind(this));

        logger.info("Initialized event-service");
        callback();
    }

    private async onSensorSample(result: TopicMessage) {
        const msg = result.data as TopicSensorMessage;
        const events = await this.storage.getActiveEventDefinitions(msg.sensorId, EventTriggerType.onSensorSample);
        if (!events.length) return;

        logger.debug(`Found <${events.length}> onSensorSample event(s) for sensor <${msg.sensorId}>`);
        for (const ev of events) {
            try {
                await this.executeAction(ev, msg.sensorId);
            } catch (err) {
                logger.error(`Error executing event <${ev.id}>: ${err.message}`);
            }
        }
    }

    private async onSensorTimeout(result: TopicMessage) {
        const msg = result.data as TopicControlMessage;
        if (!msg.sensorId) return;

        const events = await this.storage.getActiveEventDefinitions(msg.sensorId, EventTriggerType.onSensorTimeout);
        if (!events.length) return;

        logger.debug(`Found <${events.length}> onSensorTimeout event(s) for sensor <${msg.sensorId}>`);
        for (const ev of events) {
            try {
                await this.executeAction(ev, msg.sensorId);
            } catch (err) {
                logger.error(`Error executing event <${ev.id}>: ${err.message}`);
            }
        }
    }

    private async onDeviceTimeout(result: TopicMessage) {
        const msg = result.data as TopicControlMessage;
        if (!msg.deviceId) return;

        const events = await this.storage.getActiveEventDefinitions(msg.deviceId, EventTriggerType.onDeviceTimeout);
        if (!events.length) return;

        logger.debug(`Found <${events.length}> onDeviceTimeout event(s) for device <${msg.deviceId}>`);
        for (const ev of events) {
            try {
                await this.executeAction(ev, msg.deviceId);
            } catch (err) {
                logger.error(`Error executing event <${ev.id}>: ${err.message}`);
            }
        }
    }

    private async executeAction(ev: EventDefinition, targetId: string) {
        switch (ev.actionType) {
            case EventActionType.persist_value:
                await this.executePersistValue(ev, targetId);
                break;
            default:
                logger.warn(`Unknown action type <${ev.actionType}> for event <${ev.id}>`);
        }
    }

    private async executePersistValue(ev: EventDefinition, targetId: string) {
        const value = ev.actionConfig.value;
        if (value === undefined || value === null) {
            logger.error(`Event <${ev.id}> persist_value action has no value configured`);
            return;
        }
        const sensor = await this.storage.getSensor(this.identity, targetId);
        logger.info(`Persisting value <${value}> for sensor <${sensor.id}> (event <${ev.id}>)`);
        await this.storage.persistSensorSample(sensor, value, moment.utc());
    }
}
