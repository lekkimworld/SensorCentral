import {Pushover} from "node-pushover";
import { BaseService } from "../types";
import { LogService } from "./log-service";

// get pushover data from env
const PUSHOVER_APPTOKEN = process.env.PUSHOVER_APPTOKEN
const PUSHOVER_USERKEY = process.env.PUSHOVER_USERKEY
const pushover = (function() {
    if (PUSHOVER_USERKEY && PUSHOVER_APPTOKEN) {
        return new Pushover({
            token: PUSHOVER_APPTOKEN,
            user: PUSHOVER_USERKEY
        })
    }
})()
if (!pushover) {
    // nothing to do here
    console.log('Pushover support not configured...')
}

export class PushoverService extends BaseService {
    logService? : LogService;

    constructor() {
        super("pushover");
        this.dependencies = ["log"];
    }
    init(callback : (err? : Error) => {}, services : BaseService[]) {
        this.logService = services[0] as unknown as LogService;
        callback();
    }
    notify(title : string, msg : string) : void {
        if (!pushover) return
        this.logService!.debug(`Asked to notify with payload title=${title} and msg=${msg}`)
        pushover.send(title, msg)
    }
}
