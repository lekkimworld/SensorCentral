import { Connection, Channel } from "amqplib";
import {connect} from "amqplib";
import { Logger } from "./logger";

const logger = new Logger("configure-queues-topics");

const url:string|undefined = process.env.CLOUDAMQP_URL;
if (!url) throw Error('Missing CLOUDAMQP_URL environtment variable');

const connection:Promise<Connection> = new Promise(async (resolve, reject) => {
    let retries = 5;

    while (retries) {
        try {
            let conn = await connect(url);
            logger.info("Acquired AMQP connection");
            resolve(conn);
            break;

        } catch (err) {
            retries -= 1;
            logger.warn(`AMQP retries left: ${retries}`);
            await new Promise((res) => setTimeout(res, 5000));
        }
    }
    reject(new Error("Unable to get AMQP connection within 5 retries"));
});

export interface IPublishResult {
    "exchangeName":string,
    "routingKey"?:string,
    "data":any
}
export interface ISubscriptionResult extends IPublishResult {
    "callback": () => void;
}
export class PublishError extends Error implements IPublishResult {
    exchangeName:string;
    routingKey:string|undefined;
    data:object;
    constructor(msg:string, exchangeName:string, routingKey:string|undefined, data:object) {
        super(`Unable to post to exchange: ${msg}`);
        this.exchangeName = exchangeName;
        this.routingKey = routingKey;
        this.data = data;
    }
}
export interface IPublishSubscribe {
    publish : (data:object) => Promise<IPublishResult>;
    subscribe : (callback:(result:ISubscriptionResult) => void) => void;
}

const publish = (exchangeName:string, routingKey?:string) => (data:object) : Promise<IPublishResult> => {
    return connection.then((conn:Connection) => {
        return conn.createChannel();
    }).then((ch:Channel) => {
        if (routingKey) {
            // assume topic
            return ch.assertExchange(exchangeName, "topic", {"durable": false}).then(() => {
                ch.publish(exchangeName, routingKey, Buffer.from(JSON.stringify(data)));
                return ch.close();
            })
        } else {
            // assume queue
            return ch.assertQueue(exchangeName).then(() => {
                ch.sendToQueue(exchangeName, Buffer.from(JSON.stringify(data)));
                return ch.close();
            })
        }
    }).then(() => {
        return Promise.resolve({
            "exchangeName": exchangeName,
            "routingKey": routingKey,
            "data": data
        })
    }).catch((err:Error) => {
        return Promise.reject(new PublishError(err.message, exchangeName, routingKey, data));
    })
}

const subscribe = (exchangeName:string, routingKey?:string) => (callback:(result:ISubscriptionResult) => void) => {
    connection.then((conn:Connection) => {
        return conn.createChannel();
    }).then((ch:Channel) => {
        if (routingKey) {
            // assume topic
            return ch.assertExchange(exchangeName, "topic", {"durable": false}).then(() => {
                return ch.assertQueue("", {"exclusive": true})
            }).then(q => {
                logger.info(`subscribe - binding channel to topic - exchange <${exchangeName}>, key <${routingKey}>`)
                ch.bindQueue(q.queue, exchangeName, routingKey);
                ch.consume(q.queue, msg => {
                    if (msg === null) return;
                    let payload = msg.content;
                    try {
                        var payloadObj = JSON.parse(payload.toString("utf8"));
                    } catch (err) {}
                    try {
                        callback({
                            "exchangeName": exchangeName,
                            "routingKey": msg.fields.routingKey,
                            "data": payloadObj, 
                            "callback": () => {}
                        })
                    } catch (err) {
                        logger.error(`subscribe - ERROR caught when calling back with message for exchange <${exchangeName}> and routing key <${routingKey}>: ${err.message}`)
                    }
                }, {"noAck": true});
            })
        } else {
            // assume queue
            return ch.assertQueue(exchangeName).then(q => {
                logger.info(`subscribe - binding channel to queue <${q.queue}>`)
                ch.consume(exchangeName, msg => {
                    if (msg === null) return;
                    let payload:any = msg.content;
                    let payloadObj:object;
                    try {
                        payloadObj = JSON.parse(payload);
                    } catch (err) {}
                    setImmediate(() => {
                        try {
                            callback({
                                "exchangeName": exchangeName,
                                "routingKey": undefined,
                                "data": payloadObj,
                                "callback": () => ch.ack(msg)
                            });
                        } catch (err) {
                            logger.error(`subscribe - ERROR caught when calling back with message for queue <${exchangeName}>: ${err.message}`)
                        }
                    })
                })
            })
        }        
    })
}

export const close = () : Promise<void> => {
    return connection.then((conn:Connection) => {
        return conn.close()
    })
}

class PublishSubscribeCache {
    _cache : Map<string,IPublishSubscribe> = new Map();   
    getQueue = (exchangeName:string) : IPublishSubscribe => {
        const x : IPublishSubscribe | undefined = this._cache.get(exchangeName);
        if (x) return x;
        const v:IPublishSubscribe = {
            publish: publish(exchangeName),
            subscribe: subscribe(exchangeName)
        }
        this._cache.set(exchangeName, v);
        return v;
    }
    getTopic = (exchangeName:string, routingKey:string) : IPublishSubscribe => {
        const compoundKey = `${exchangeName}|${routingKey}`;
        const x : IPublishSubscribe | undefined = this._cache.get(compoundKey);
        if (x) return x;
        const v:IPublishSubscribe = {
            publish: publish(exchangeName, routingKey),
            subscribe: subscribe(exchangeName, routingKey)
        }
        this._cache.set(compoundKey, v);
        return v;
    }
}

// define cache
const cache = new PublishSubscribeCache();
export const getQueue = (exchangeName:string) : IPublishSubscribe => {
    return cache.getQueue(exchangeName);
};
export const getTopic = (exchangeName:string, routingKey:string) : IPublishSubscribe => {
    return cache.getTopic(exchangeName, routingKey);
}

