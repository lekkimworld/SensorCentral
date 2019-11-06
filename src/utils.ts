import Moment from 'moment-timezone';
import moment = require("moment-timezone");
import {constants} from "./constants";

export const formatDate = function(date? : any) : string {
    // see if already a "moment" instance
    let m = (date && date['diff'] ? date : date ? Moment(date) : Moment()) as moment.Moment;
    return m.tz(constants.DEFAULTS.TIMEZONE).format(constants.DEFAULTS.DATETIME_FORMAT);
}
