import moment from "moment-timezone";
import constants from "../constants";
import { Logger } from "../logger";
import { BackendIdentity, BaseService, Device, EventActionType, EventDefinition, EventTriggerType, InitCallback, Sensor, TopicControlMessage, TopicSensorMessage } from "../types";
import CalloutService from "./callout-service";
import { IdentityService } from "./identity-service";
import { PubsubService, TopicMessage } from "./pubsub-service";
import { RedisService } from "./redis-service";
import { StorageService } from "./storage-service";

const logger = new Logger("event-service");

export class EventService extends BaseService {
    public static NAME = "event";
    private storage!: StorageService;
    private identityService!: IdentityService;
    private identity!: BackendIdentity;
    private calloutService!: CalloutService;
    private redis!: RedisService;

    constructor() {
        super(EventService.NAME);
        this.dependencies = [PubsubService.NAME, StorageService.NAME, IdentityService.NAME, CalloutService.NAME, RedisService.NAME];
    }

    async init(callback: InitCallback, services: BaseService[]) {
        const pubsub = services[0] as PubsubService;
        this.storage = services[1] as StorageService;
        this.identityService = services[2] as IdentityService;
        this.identity = this.identityService.getServiceBackendIdentity(EventService.NAME);
        this.calloutService = services[3] as CalloutService;
        this.redis = services[4] as RedisService;

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
                await this.executeAction(ev, msg.sensorId, { sensorValue: msg.value, deviceId: msg.deviceId });
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

    private async executeAction(ev: EventDefinition, targetId: string, extra?: Record<string, any>) {
        let actionDetail = "";
        let success = true;
        let error: string | null = null;
        let requestInfo: string | null = null;
        let responseInfo: string | null = null;

        try {
            switch (ev.actionType) {
                case EventActionType.persist_value:
                    actionDetail = `value: ${ev.actionConfig.value}`;
                    await this.executePersistValue(ev, targetId);
                    break;
                case EventActionType.callout:
                    actionDetail = await this.resolveCalloutName(ev);
                    const details = await this.executeCallout(ev, targetId, extra);
                    if (details) {
                        requestInfo = `${details.request.method} ${details.request.url}${details.request.body ? "\n" + details.request.body : ""}`;
                        responseInfo = `${details.response.status}\n${details.response.body}`;
                    }
                    break;
                default:
                    logger.warn(`Unknown action type <${ev.actionType}> for event <${ev.id}>`);
                    return;
            }
        } catch (err: any) {
            success = false;
            error = err.message || String(err);
        }

        const resolved = await this.resolveTarget(ev, targetId);
        const userId = ev.userId || resolved.userId;
        if (userId) {
            await this.logEvent(userId, {
                timestamp: moment.utc().toISOString(),
                triggerType: ev.triggerType,
                targetId,
                targetName: resolved.name,
                targetPath: resolved.path,
                actionType: ev.actionType,
                actionDetail,
                success,
                error,
                request: requestInfo,
                response: responseInfo,
            });
        }
    }

    private async resolveTarget(ev: EventDefinition, targetId: string): Promise<{ userId: string | null; name: string; path: string }> {
        try {
            if (ev.triggerType === EventTriggerType.onDeviceTimeout) {
                const device = await this.storage.getDevice(this.identity, targetId);
                if (device) {
                    const users = await this.storage.getHouseUsers(this.identity, device.house.id);
                    const owner = users.find(u => u.owner);
                    const path = `#configuration/house/${device.house.id}/device/${device.id}`;
                    return { userId: owner ? owner.id : null, name: `Device: ${device.name}`, path };
                }
            } else {
                const sensor = await this.storage.getSensor(this.identity, targetId);
                if (sensor && sensor.device) {
                    const houseId = sensor.device.house.id;
                    const users = await this.storage.getHouseUsers(this.identity, houseId);
                    const owner = users.find(u => u.owner);
                    const path = `#configuration/house/${houseId}/device/${sensor.deviceId}/sensor/${sensor.id}`;
                    return { userId: owner ? owner.id : null, name: `Sensor: ${sensor.name}`, path };
                }
            }
        } catch {}
        return { userId: null, name: targetId, path: "" };
    }

    private async resolveCalloutName(ev: EventDefinition): Promise<string> {
        const calloutId = ev.actionConfig.calloutId;
        if (!calloutId || !ev.userId) return calloutId || "";
        try {
            const userIdentity = this.identityService.getImpersonationIdentity(this.identity, ev.userId);
            const callouts = await this.storage.getUserCallouts(userIdentity);
            const c = callouts.find((c: any) => c.id === calloutId);
            return c ? c.name : calloutId;
        } catch {
            return calloutId;
        }
    }

    private async logEvent(userId: string, entry: { timestamp: string; triggerType: string; targetId: string; targetName: string; targetPath: string; actionType: string; actionDetail: string; success: boolean; error: string | null; request?: string | null; response?: string | null }) {
        const key = `event_log:${userId}`;
        const json = JSON.stringify(entry);
        const client = this.redis.getClient();
        const maxEntries = constants.DEFAULTS.EVENT_LOG.MAX_ENTRIES;
        const ttl = constants.DEFAULTS.EVENT_LOG.TTL_SECS;
        await client.lpush(key, json);
        await client.ltrim(key, 0, maxEntries - 1);
        await this.redis.expire(key, ttl);
    }

    private async executePersistValue(ev: EventDefinition, targetId: string) {
        const value = ev.actionConfig.value;
        if (value === undefined || value === null) {
            throw new Error(`persist_value action has no value configured`);
        }
        const sensor = await this.storage.getSensor(this.identity, targetId);
        logger.info(`Persisting value <${value}> for sensor <${sensor.id}> (event <${ev.id}>)`);
        await this.storage.persistSensorSample(sensor, value, moment.utc());
    }

    private async hydrateTarget(ev: EventDefinition, targetId: string): Promise<Sensor | Device | undefined> {
        try {
            if (ev.triggerType === EventTriggerType.onDeviceTimeout) {
                return await this.storage.getDevice(this.identity, targetId);
            } else {
                return await this.storage.getSensor(this.identity, targetId);
            }
        } catch {
            return undefined;
        }
    }

    private async executeCallout(ev: EventDefinition, targetId: string, extra?: Record<string, any>) {
        const calloutId = ev.actionConfig.calloutId;
        if (!calloutId) {
            throw new Error(`callout action has no calloutId configured`);
        }
        if (!ev.userId) {
            throw new Error(`callout action has no userId — cannot resolve callout`);
        }

        const userIdentity = this.identityService.getImpersonationIdentity(this.identity, ev.userId);
        const target = await this.hydrateTarget(ev, targetId);
        const ctx = {
            targetId,
            target,
            triggerType: ev.triggerType,
            timestamp: moment.utc().toISOString(),
            ...extra,
        };

        logger.info(`Executing callout <${calloutId}> for event <${ev.id}> target <${targetId}>`);
        return this.calloutService.calloutByIdWithDetails(userIdentity, calloutId, ctx);
    }
}
