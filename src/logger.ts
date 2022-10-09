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

const logit = (level : Level, loggerName : string, msg : string, err? : Error) => {
    if (err) {
        console.log(`${loggerName} - ${level.name} - ${msg} (${err.message})`, err);
    } else {
        console.log(`${loggerName} - ${level.name} - ${msg}`);
    }
}

export class Logger {
    _name : string;
    constructor(name:string) {
        this._name = name;
        
    }
    debug(msg:string) : void {
        logit(DEBUG, this._name, msg);
    }
    info(msg:string) : void {
        logit(INFO, this._name, msg);
    }
    warn(msg:string, err?:Error) : void {
        logit(WARN, this._name, msg, err);
    }
    error(msg:string, err?:Error) : void {
        logit(ERROR, this._name, msg, err);
    }
}
