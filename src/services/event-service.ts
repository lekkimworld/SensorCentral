import {BaseService} from "../types";
import * as events from "../configure-queues-topics";

export class EventService extends BaseService {
    public static NAME = "event";

    constructor() {
        super(EventService.NAME);
    }
    init(callback : (err?:Error) => {}) {
        events.amqpReady.then(() => {
            callback();
        }).catch(err => {
            callback(err);
        })
    }
    terminate() {
        return events.close();
    }
    publishQueue(exchangeName:string, data:object) : Promise<events.IPublishResult> {
        return events.getQueue(exchangeName).publish(data);
    }
    subscribeQueue(exchangeName:string, callback:(result:events.ISubscriptionResult) => void) {
        events.getQueue(exchangeName).subscribe(callback);
    }
    publishTopic(exchangeName:string, routingKey:string, data:object) : Promise<events.IPublishResult> {
        return events.getTopic(exchangeName, routingKey).publish(data);
    }
    subscribeTopic(exchangeName:string, routingKey:string, callback:(result:events.ISubscriptionResult) => void) {
        return events.getTopic(exchangeName, routingKey).subscribe(callback);
    }
} 
