import { Logger } from "../../logger";
import { Device, Sensor } from "../../types";
import Watchdog from "watchdog";

const logger = new Logger("watchdog-types");

export interface WatchdogTarget {
    id: string;
    timeoutMs: number;
    target: Sensor | Device;
}

export class WatchdogTimer {
    readonly id: string;
    readonly timeoutMs: number;
    target: Sensor | Device;
    wd: Watchdog;

    constructor(target: Sensor | Device, timeoutMs: number) {
        this.id = target.id;
        this.timeoutMs = timeoutMs;
        this.target = target;
    }

    isSensor(): boolean {
        return "deviceId" in this.target;
    }

    start(onTimeout: (timer: WatchdogTimer) => void) {
        this.wd = new Watchdog(this.timeoutMs);
        this.wd.on("reset", () => {
            this.feed();
            onTimeout(this);
        });
        this.feed();
    }

    feed() {
        logger.debug(`Feeding watchdog for target <${this.id}>`);
        this.wd.feed({ type: "timeout", data: this });
        logger.debug(`Fed watchdog for target <${this.id}>`);
    }

    stop() {
        if (this.wd) {
            this.wd.removeAllListeners();
            this.wd.sleep();
        }
    }
}
