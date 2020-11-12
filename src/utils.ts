import Moment from 'moment-timezone';
import moment = require("moment-timezone");
import constants from "./constants";
const pckg = require('../package.json');

export const formatDate = function(date? : any, format? : string) : string {
    // see if already a "moment" instance
    let m = (date && date['diff'] ? date : date ? Moment(date) : Moment()) as moment.Moment;
    return m.tz(constants.DEFAULTS.TIMEZONE).format(format || constants.DEFAULTS.DATETIME_FORMAT);
}

export const buildBaseHandlebarsContext = () : any => {
    return {
        "app_name": pckg.name,
        "app_version": pckg.version
    }
}
