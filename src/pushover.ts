const Pushover = require("node-pushover");
//@ts-ignore
import { lookupService } from "./configure-services";
import { LogService } from "./services/log-service";
import { PushoverMessage } from "./types";


export default async ({ title, message, settings } : PushoverMessage) => {
    const log = await lookupService("log") as LogService;
    const p = new Pushover({
        "token": settings.apptoken,
        "user": settings.userkey
    });
    log!.debug(`Asked to notify with payload title=${title} and msg=${message}`)
    p.send(title, message);
}
