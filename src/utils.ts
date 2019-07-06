import * as moment from "moment-timezone";
import {constants} from "./constants";

export const formatDate = function(date? : unknown) : string {
    // see if already a "moment" instance
    let m = (date && date['diff'] ? date : date ? moment(date) : moment()) as moment.Moment;
    return m.tz(constants.DEFAULTS.TIMEZONE).format(constants.DEFAULTS.DATETIME_FORMAT);
}
