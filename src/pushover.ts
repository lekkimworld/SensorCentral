const Pushover = require("node-pushover");
//@ts-ignore
import { lookupService } from "./configure-services";
import { LogService } from "./services/log-service";

export interface PushoverMessage {
    apptoken : string;
    userkey : string;
    title : string;
    message : string;
}

export default async ({ title, message, apptoken, userkey } : PushoverMessage) => {
    const log = await lookupService("log") as LogService;
    const p = new Pushover({
        "token": apptoken,
        "user": userkey
    });
    log!.debug(`Asked to notify with payload title=${title} and msg=${message}`)
    p.send(title, message);
}
