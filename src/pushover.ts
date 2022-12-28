const Pushover = require("node-pushover");
import { Logger } from "./logger";
import { PushoverMessage } from "./types";

const log = new Logger("pushover");

export default async ({ title, message, settings } : PushoverMessage) => {
    const p = new Pushover({
        token: settings.apptoken,
        user: settings.userkey
    });
    log!.debug(`Asked to notify with payload title=${title} and msg=${message}`)
    p.send(title, message);
}
