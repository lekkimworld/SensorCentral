import Moment from 'moment-timezone';
import moment = require("moment-timezone");
import {constants} from "./constants";
import { RedisSensorMessage, Sensor, SensorReading } from './types';
const pckg = require('../package.json');

export const formatDate = function(date? : any) : string {
    // see if already a "moment" instance
    let m = (date && date['diff'] ? date : date ? Moment(date) : Moment()) as moment.Moment;
    return m.tz(constants.DEFAULTS.TIMEZONE).format(constants.DEFAULTS.DATETIME_FORMAT);
}

export const buildBaseHandlebarsContext = (req : Express.Request) : any => {
    req.sessionID;
    return {
        "app_name": pckg.name,
        "app_version": pckg.version
    }
}

export const convert = (redisObj : RedisSensorMessage, sensor : Sensor | undefined) : SensorReading => {
    // @ts-ignore
    let m = redisObj && redisObj.dt ? Moment(redisObj.dt) : null;
    // @ts-ignore
    let denominator = sensor ? constants.SENSOR_DENOMINATORS[sensor.type] : "??";
    const result = {
        "deviceId": redisObj && redisObj.deviceId ? redisObj.deviceId : undefined,
        "device": sensor ? sensor.device : undefined,
        "id": redisObj ? redisObj.id : undefined,
        "label": sensor ? sensor.label : undefined,
        "name": sensor ? sensor.name : undefined,
        "type": sensor ? sensor.type : undefined,
        "value": redisObj ? redisObj!.value : null,
        "value_string": redisObj ? `${redisObj.value.toFixed(2)}${denominator}` : null,
        "dt": redisObj ? redisObj.dt : null,
        "dt_string": redisObj && redisObj.dt ? formatDate(redisObj!.dt) : null,
        "ageMinutes": m ? Moment().diff(m, 'minutes') : -1,
        "denominator": denominator
    } as SensorReading;
    return result;
}