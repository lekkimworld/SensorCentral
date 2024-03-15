import * as moment from "moment";
import "moment-timezone";
import constants from "./constants";

export const TIMEZONE = constants.TIMEZONE;
export const DATETIME_DATETIME_SHORT = "D/M HH:mm";
const DATETIME_FORMAT = "D-M-YYYY [kl.] k:mm";

export const formatWithFormat = (date: string | Date, format: string, defaultValue?: string) => {
    let use_date;
    if (!date && defaultValue) {
        return defaultValue;
    } else if (!date) {
        use_date = moment();
    } else if (typeof date === "string") {
        // assume iso date
        use_date = moment.utc(date);
    } else if (typeof date === "object") {
        // assume date instance
        use_date = moment(date);
    } else {
        throw Error('Unknown date argument type')
    }
    return use_date.tz(constants.TIMEZONE).format(format || "DD-MM-YYYY kk:mm");
}

export const formatDMYTime = (date, defaultValue?) => {
    return formatWithFormat(date, DATETIME_FORMAT, defaultValue);
}

export type TimeDiffereceOptions = {
    scale?: "seconds" | "hours" | "minutes";
    defaultValue?: string;
    format?: string;
    maxDiff?: number;
};
export const timeDifference = (date, options : TimeDiffereceOptions = {}) => {
    if (!date) return undefined;
    let use_date = typeof date === "string" ? moment.utc(date) : moment(date);
    const moment_diff = moment.duration(moment().diff(use_date));
    let diff;
    if ("scale" in options) {
        switch (options.scale) {
            case "seconds": 
                diff = moment_diff.asSeconds();
                break;
            case "hours":
                diff = moment_diff.asHours();
                break;
            case "minutes":
            default:
                diff = moment_diff.asMinutes();
                break;
        }
    } else {
        diff = moment_diff.asMinutes();
    }
    return Math.floor(diff);

}

export const timeDifferenceAsString = (date, options : TimeDiffereceOptions = {}) => {
    const diff = timeDifference(date, options);
    if (undefined === diff) return options.defaultValue || "N/A";
    
    if (options.maxDiff && diff > options.maxDiff) {
        return formatDMYTime(date, options.format);
    }
    if ("scale" in options) {
        switch (options.scale) {
            case "seconds": 
                return `${diff} sek.`;
            case "minutes":
                return `${diff} min.`;
            case "hours":
                return `${diff} time(r)`;
        }
    }
    return `${diff} min(s).`;
}
