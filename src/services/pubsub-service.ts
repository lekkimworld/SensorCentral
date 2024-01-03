import { Redis } from "ioredis";
import {BaseService} from "../types";
import { RedisService } from "./redis-service";
import { Logger } from "../logger";
import { minimatch } from "minimatch";

const logger = new Logger("pubsub-service");

type TopicSubscriptionBase = {
    callback: TopicSubscriptionCallback;
};
type TopicExactSubscription = TopicSubscriptionBase & {
    channel: string;
}
type TopicPatternSubscription = TopicSubscriptionBase & {
    pattern: string;
};
export type TopicMessage = {
    data: any;
    channel: string;
}
export type TopicSubscriptionCallback = (msg: TopicMessage) => void;

export class PubsubService extends BaseService {
    public static NAME = "pubsub";
    private redis!: RedisService;
    private clientPub!: Redis;
    private clientSub!: Redis;
    private exactSubs: Array<TopicExactSubscription> = [];
    private patternSubs: Array<TopicPatternSubscription> = [];

    constructor() {
        super(PubsubService.NAME);
        this.dependencies = [RedisService.NAME];
    }

    async init(callback: (err?: Error) => {}, services: BaseService[]) {
        logger.info(`Initializing service`);
        this.redis = services[0] as RedisService;
        this.clientPub = this.redis.createClient({});
        this.clientSub = this.redis.createClient({});
        this.clientSub.on("message", (channel, strdata) => {
            logger.debug(`Received message on channel <${channel}> data <${strdata}>`);
            const data = JSON.parse(strdata);

            // find listeners and notify
            this.exactSubs.forEach(sub => {
                if (sub.channel === channel) {
                    try {
                        sub.callback({
                            channel,
                            data
                        });
                    } catch (err) {
                        logger.warn(`Error from exact subscriber channel <${channel}> data <${data}>`, err);
                    }
                }
            });
        });
        this.clientSub.on("pmessage", (_subscriptionPattern, channel, strdata) => {
            logger.debug(`Received pattern message on channel <${channel}> data <${strdata}>`);
            const data = JSON.parse(strdata);

            this.patternSubs.forEach((sub) => {
                const mm = minimatch(channel, sub.pattern);
                if (mm) {
                    logger.debug(`Found subscriber for channel <${channel}> with pattern <${sub.pattern}> - calling callback`);
                    try {
                        sub.callback({
                            channel,
                            data
                        });
                    } catch (err) {
                        logger.warn(`Error from pattern subscriber channel <${channel}> data <${data}>`, err);
                    }
                }
            });
        });
        logger.info(`Initialized service and created own Redis client - calling back`);
        callback();
    }

    async publish(channel: string, data: object): Promise<void> {
        logger.debug(`Publishing on channel <${channel}> data <${JSON.stringify(data)}}>`);
        await this.clientPub.publish(channel, JSON.stringify(data));
    }

    async subscribe(channel: string, callback: TopicSubscriptionCallback): Promise<void> {
        if (channel.indexOf("*") >= 0) {
            // add state
            this.patternSubs.push({
                callback,
                pattern: channel,
            });

            // subscribe
            logger.debug(`Subscribing to channel pattern <${channel}>`);
            this.clientSub.psubscribe(channel);
        } else {
            // add state
            this.exactSubs.push({
                callback,
                channel
            });

            // subscribe
            logger.debug(`Subscribing to exact channel <${channel}>`);
            this.clientSub.subscribe(channel);
        }
    }
}