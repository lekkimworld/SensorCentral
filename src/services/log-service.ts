import {BaseService} from "../types";

export interface Level {
    readonly name : string;
    readonly num : number;
}
class LevelImpl implements Level {
    readonly name : string;
    readonly num : number;
    constructor(name:string, num:number) {
        this.name = name;
        this.num = num;
    }
}
export const DEBUG : Level = new LevelImpl("DEBUG", 0);
export const INFO : Level = new LevelImpl("INFO", 10);
export const WARN : Level = new LevelImpl("WARN", 100);
export const ERROR : Level = new LevelImpl("ERROR", 1000);

const logit = (level : Level, msg : string, err? : Error) => {
    if (err) {
        console.log(`${level.name} - ${msg} (${err.message})`, err)
    } else {
        console.log(`${level.name} - ${msg}`)
    }
}

export class LogService extends BaseService {
    public static NAME = "log";

    constructor() {
        super(LogService.NAME);
    }
    debug(msg:string) : void {
        logit(DEBUG, msg);
    }
    info(msg:string) : void {
        logit(INFO, msg);
    }
    warn(msg:string, err?:Error) : void {
        logit(WARN, msg, err);
    }
    error(msg:string, err?:Error) : void {
        logit(ERROR, msg, err);
    }
}
