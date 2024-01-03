import {BaseService} from "../types";
import { Queue, Worker } from "bullmq";
import { RedisService } from "./redis-service";
import { Redis } from "ioredis";
import { v4 as uuid } from "uuid";
import { Logger } from "../logger";
import { PromisifiedSemaphore } from "../utils";
import { ExpressService } from "./express-service";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { BaseAdapter } from "@bull-board/api/dist/src/queueAdapters/base";

const logger = new Logger("queue-service");

export type QueueSubscription = {
    queueName: string;
    data: object;
    callback: () => void;
};
export type QueueSubscriptionCallback = (result: QueueSubscription) => void;
export type QueueSubscriptionErrorCallback = (err: Error) => void;

class WorkerWrapper {
    private queueName: string;
    private semaphore = new PromisifiedSemaphore(1);
    private worker : Worker;
    private listeners : Array<QueueSubscriptionCallback> = [];

    constructor(queueName: string, redisClient: Redis) {
        this.queueName = queueName;
        this.worker = new Worker(this.queueName, async job => {
            // get data and parse
            const str = job.data as string;
            const data = JSON.parse(str);
            logger.debug(`Received message on queue <${queueName}> with data <${str}>`);
            
            // loop listeners
            logger.trace(`Calling back to <${this.listeners.length}> listeners for queue <${queueName}>`);
            this.listeners.forEach((l, idx) => {
                // callback to each
                try {
                    logger.trace(`Calling back to listener idx <${idx}> on queue <${queueName}>`);
                    l({
                        queueName,
                        data,
                        callback: () => {
                            logger.warn(`Callback on callback to queue <${queueName}>`);
                        }
                    })
                    logger.trace(`Successfully called listener idx <${idx}> on queue <${queueName}>`);
                } catch (err) {
                    logger.warn(`Error calling listener idx <${idx}> on queue <${queueName}>`, err);
                }
            })
        }, {
            connection: redisClient
        })
    }

    async addListener(callback: QueueSubscriptionCallback) {
        logger.debug(`Adding listener for queue <${this.queueName}>`);
        await this.semaphore.take();
        this.listeners.push(callback);
        this.semaphore.leave();
    }

    async close() {
        logger.info(`Closing worker for queue <${this.queueName}>`);
        return this.worker.close();
    }
}

export class QueueService extends BaseService {
    public static NAME = "queue";
    private redis!: RedisService;
    private express!: ExpressService;
    private addQueue: (queue: BaseAdapter) => void;
    private queueCache: Record<string, Queue> = {};
    private workerQueue: Record<string, WorkerWrapper> = {};
    private semaphore = new PromisifiedSemaphore(1);

    constructor() {
        super(QueueService.NAME);
        this.dependencies = [RedisService.NAME, ExpressService.NAME];
    }

    async init(callback: (err?: Error) => {}, services: BaseService[]) {
        this.redis = services[0] as RedisService;
        this.express = services[1] as ExpressService;

        // attach bull board
        const serverAdapter = new ExpressAdapter();
        serverAdapter.setBasePath("/admin/queues");
        const { addQueue } = createBullBoard({
            queues: [],
            serverAdapter,
        });
        this.addQueue = addQueue;
        this.express.getExpress()!.use("/admin/queues", serverAdapter.getRouter());

        // callback
        callback();
    }

    async terminate(): Promise<void> {
        await this.semaphore.take();
        await Promise.all(
            Object.values(this.workerQueue).map((w) => {
                return w.close();
            })
        );
        this.workerQueue = {};
        this.semaphore.leave();
    }

    /**
     * Ensure we have the queue with the supplied name, adds to cache and 
     * bull board.
     * 
     * @param queueName 
     * @returns 
     */
    private async ensureQueue(queueName: string) : Promise<Queue> {
        let q = this.queueCache[queueName];
        if (!q) {
            // create queue
            q = new Queue(queueName, {
                connection: this.redis.createClient(),
                defaultJobOptions: {
                    attempts: 3,
                    backoff: {
                        type: "exponential",
                        delay: 3000,
                    },
                    removeOnComplete: {
                        // keep 100 jobs for a max 24 hours
                        count: 100,
                        age: 24 * 3600,
                    },
                    removeOnFail: 1000,
                },
            });

            // add to bull board
            logger.debug(`Adding queue <${queueName}> to bull board`);
            this.addQueue(new BullMQAdapter(q));

            // add to cache
            await this.semaphore.take();
            this.queueCache[queueName] = q;
            this.semaphore.leave();
        }
        return q;
    }

    async publish(queueName: string, data: object): Promise<void> {
        let q = await this.ensureQueue(queueName);

        // add job ob queue
        q.add(`${queueName}#${uuid()}`, JSON.stringify(data));
    }

    async subscribe(queueName: string, callback: QueueSubscriptionCallback) {
        let w = this.workerQueue[queueName];
        if (!w) {
            // create worker wrapper
            w = new WorkerWrapper(
                queueName,
                this.redis.createClient({
                    maxRetriesPerRequest: null,
                })
            );
            await this.semaphore.take();
            this.workerQueue[queueName] = w;
            this.semaphore.leave();
        }
        w.addListener(callback);

        // add queue
        this.ensureQueue(queueName);
    }
}