import moment, {Moment} from 'moment-timezone';
import constants from "./constants";
import semaphore, { Semaphore } from "semaphore";

export const formatDate = function(date? : any, format? : string) : string {
    // see if already a "moment" instance
    let m = (date && date['diff'] ? date : date ? moment(date) : moment()) as Moment;
    return m.tz(constants.DEFAULTS.TIMEZONE).format(format || constants.DEFAULTS.DATETIME_FORMAT);
}

export const objectHasOwnProperty = (obj : any, prop : string) : boolean => {
    return Object.prototype.hasOwnProperty.call(obj, prop);
}

export const objectHasOwnProperty_Trueish = (obj : any, prop : string) : boolean => {
    if (!objectHasOwnProperty(obj, prop)) return false;
    const value = obj[prop] as string;
    if (value && value.length > 0 && (value === "1" || value.toLowerCase().indexOf("t") === 0)) {
        return true;
    } else {
        return false;
    }
}

export const objectHasOwnProperty_Falseish = (obj: any, prop: string): boolean => {
    if (!objectHasOwnProperty(obj, prop)) return false;
    const value = obj[prop] as string;
    if (value && value.length > 0 && (value === "0" || value.toLowerCase().indexOf("f") === 0)) {
        return true;
    } else {
        return false;
    }
};

export const buildBaseHandlebarsContext = () : any => {
    return {
        app_name: constants.APP.NAME,
        app_version: constants.APP.VERSION,
        app_current_year: new Date().getFullYear(),
        app_gitcommit: constants.APP.GITCOMMIT,
        app_gitcommit_url: `https://github.com/lekkimworld/SensorCentral/commit/${constants.APP.GITCOMMIT}`,
        app_title: constants.APP.TITLE,
    };
}

export class PromisifiedSemaphore {
    _sem: Semaphore;
    readonly capacity: number;
    constructor(num: number) {
        this._sem = semaphore(num);
        this.capacity = num;
    }
    async take(): Promise<void> {
        return new Promise<void>((resolve) => {
            this._sem.take(resolve);
        });
    }
    leave(): void {
        this._sem.leave();
    }
}