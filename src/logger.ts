export interface Level {
    readonly name: string;
    readonly num: number;
}
class LevelImpl implements Level {
    readonly name: string;
    readonly num: number;
    constructor(name: string, num: number) {
        this.name = name;
        this.num = num;
    }
}

export const TRACE: Level = new LevelImpl("TRACE", 0);
export const DEBUG: Level = new LevelImpl("DEBUG", 10);
export const INFO: Level = new LevelImpl("INFO", 100);
export const WARN: Level = new LevelImpl("WARN", 1000);
export const ERROR: Level = new LevelImpl("ERROR", 10000);

import { get as getFromHttpContext } from "express-http-context";
import constants from "./constants";

export type LogMessage = string | Record<string,string|number|boolean|any>;

export class Logger {
    _level: Level;
    _name: string;
    _system: boolean = false;

    constructor(name: string, systemLogger: boolean = false) {
        this._name = name;
        this._level = constants.APP.LOG_LEVEL(name);
        this._system = systemLogger;
    }
    protected getLogMessage(level: Level, msg: LogMessage, err?: Error) {
        const reqId = getFromHttpContext(constants.HTTP_CONTEXT.REQUEST_ID);
        const prefix = `[${reqId || ""}] [${this._name}] [${level.name}]`;

        if (this._system) {
            const loggerCtx = {
                request: {
                    id: reqId || "",
                },
                logger: {
                    name: this._name,
                    level: {
                        name: level.name,
                        num: level.num,
                    },
                },
            };
            const logObj = Object.assign(loggerCtx, typeof msg === "string" ? { message: msg } : msg);
            return `${this._name.toUpperCase()} ${JSON.stringify(logObj)}`;
        } else if (err) {
            return `${prefix} - ${msg} (${err.message})`;
        } else {
            return `${prefix} - ${msg}`;
        }
    }
    protected writeLogMessage(level: Level, msg: LogMessage, err?: Error) {
        if (level.num < this._level.num) return;
        const message = this.getLogMessage(level, msg, err);
        if (err) {
            console.log(message, err);
        } else {
            console.log(message);
        }
    }
    trace(msg: LogMessage): void {
        this.writeLogMessage(TRACE, msg);
    }
    debug(msg: LogMessage): void {
        this.writeLogMessage(DEBUG, msg);
    }
    info(msg: LogMessage): void {
        this.writeLogMessage(INFO, msg);
    }
    warn(msg: LogMessage, err?: Error): void {
        this.writeLogMessage(WARN, msg, err);
    }
    error(msg: LogMessage, err?: Error): void {
        this.writeLogMessage(ERROR, msg, err);
    }
}
