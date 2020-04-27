const moment = require("moment-timezone");

const TIMEZONE = "Europe/Copenhagen";
const formatWithFormat = (date, format) => {
    let use_date;
    if (!date) {
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
    
    return use_date.tz(TIMEZONE).format(format);
}

module.exports = {
    formatWithFormat,

    "formatDMYTime": (date) => {
        return formatWithFormat(date, "D-M-YYYY [kl.] k:mm");
    }
}
