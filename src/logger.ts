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

export class Logger {
    _level: Level;
    _name: string;
    constructor(name: string) {
        this._name = name;
        this._level = constants.APP.LOG_LEVEL(name);
    }
    protected getLogMessage(level: Level, msg: string, err?: Error) {
        const reqId = getFromHttpContext(constants.HTTP_CONTEXT.REQUEST_ID);
        const prefix = `[${reqId || ""}] [${this._name}] [${level.name}]`;

        if (err) {
            return `${prefix} - ${msg} (${err.message})`;
        } else {
            return `${prefix} - ${msg}`;
        }
    }
    protected writeLogMessage(level: Level, msg: string, err?: Error) {
        if (level.num < this._level.num) return;
        const message = this.getLogMessage(level, msg, err);
        if (err) {
            console.log(message, err);
        } else {
            console.log(message);
        }
    }
    trace(msg: string): void {
        this.writeLogMessage(TRACE, msg);
    }
    debug(msg: string): void {
        this.writeLogMessage(DEBUG, msg);
    }
    info(msg: string): void {
        this.writeLogMessage(INFO, msg);
    }
    warn(msg: string, err?: Error): void {
        this.writeLogMessage(WARN, msg, err);
    }
    error(msg: string, err?: Error): void {
        this.writeLogMessage(ERROR, msg, err);
    }
}
