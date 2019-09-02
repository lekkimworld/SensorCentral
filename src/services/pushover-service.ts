const Pushover = require("node-pushover");
import { BaseService } from "../types";
import { LogService } from "./log-service";

// get pushover data from env
const PUSHOVER_APPTOKEN = process.env.PUSHOVER_APPTOKEN
const PUSHOVER_USERKEY = process.env.PUSHOVER_USERKEY

export class PushoverService extends BaseService {
    logService? : LogService;
    pushover : any;

    constructor() {
        super("pushover");
        this.dependencies = ["log"];
    }
    init(callback : (err? : Error) => {}, services : BaseService[]) {
        this.logService = services[0] as unknown as LogService;

        if (PUSHOVER_USERKEY && PUSHOVER_APPTOKEN) {
            this.logService!.info(`PUSHOVER_USERKEY and PUSHOVER_APPTOKEN found in environment - creating Pushover support`);
            this.pushover = new Pushover({
                token: PUSHOVER_APPTOKEN,
                user: PUSHOVER_USERKEY
            });
        } else {
            this.logService!.info(`No PUSHOVER_USERKEY and PUSHOVER_APPTOKEN found in environment - NO Pushover support`);
        }

        // callback
        callback();
    }
    notify(title : string, msg : string) : void {
        if (!this.pushover) return
        this.logService!.debug(`Asked to notify with payload title=${title} and msg=${msg}`)
        this.pushover.send(title, msg)
    }
}
