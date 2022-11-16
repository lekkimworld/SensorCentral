import Moment from 'moment-timezone';
import moment = require("moment-timezone");
import constants from "./constants";
const pckg = require('../package.json');

export const formatDate = function(date? : any, format? : string) : string {
    // see if already a "moment" instance
    let m = (date && date['diff'] ? date : date ? Moment(date) : Moment()) as moment.Moment;
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
        "app_name": constants.APP.NAME,
        "app_version": pckg.version,
        "app_current_year": new Date().getFullYear()
    }
}
