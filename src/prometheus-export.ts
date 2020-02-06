import fetch from "node-fetch";
//@ts-ignore
import excel from "node-excel-export";
import moment = require("moment-timezone");
import Moment from "moment-timezone";

export const ISO8601_DATETIME_FORMAT = "YYYY-MM-DDTHH:mm:ss.SSS[Z]";
const TIMEZONE = process.env.TIMEZONE || 'Europe/Copenhagen';
const DEFAULT_STEP = process.env.STEP || '60m';

// styles
const styles = {
    headerDark: {
        font: {
            color: {
                rgb: '000000'
            },
            sz: 14,
            bold: true
        }
    }
}

// specify the export structure
const specification = {
    datetime: {
        displayName: 'Date/time',
        headerStyle: styles.headerDark,
        width: "26"
    },
    date: {
        displayName: 'Date',
        headerStyle: styles.headerDark,
        width: "14"
    },
    time: {
        displayName: 'Time',
        headerStyle: styles.headerDark,
        width: '10'
    },
    value: {
        displayName: 'Value',
        headerStyle: styles.headerDark,
        width: "20"
    }
}

export interface ExportedSensorValue {
    value: number,
    datetime : string,
    date : string,
    time : string
}
export interface FetchOption {
    query : string,
    start : Moment.Moment,
    end : Moment.Moment,
    step? : string | undefined
}

export const fetchData = (options : FetchOption) : Promise<Array<ExportedSensorValue>> => {
    // format start and end
    const startstr = options.start.format(ISO8601_DATETIME_FORMAT);
    const endstr = options.end.format(ISO8601_DATETIME_FORMAT);
    const step = options.step || DEFAULT_STEP;
    const result : Array<ExportedSensorValue> = [];
    return fetch(`${process.env.PROMETHEUS_URL}/query_range?query=${encodeURIComponent(options.query)}&start=${encodeURIComponent(startstr)}&end=${encodeURIComponent(endstr)}&step=${encodeURIComponent(step)}`, {
        "headers": {
            "Authorization": process.env.PROMETHEUS_AUTH_HEADER as string
        }
    }).then(res => res.json()).then(result => {
        if (result.status && result.status === 'error') {
            return Promise.reject(Error(`Error: ${result.error}`))
        }
        const values = result.data.result[0].values;
        const dataset = values.reduce((prev : Array<ExportedSensorValue>, sample : any) => {
            let datetime = moment.unix(sample[0]).tz(TIMEZONE).format('DD-MM-Y HH:mm:ss');
            let date = moment.unix(sample[0]).tz(TIMEZONE).format('DD-MM-Y');
            let time = moment.unix(sample[0]).tz(TIMEZONE).format('HH:mm:ss');
            let sampleValue = sample[1] - 0;
            prev.push({
                "datetime": datetime,
                "date": date,
                "time": time,
                "value": sampleValue
            })
            return prev;
        }, new Array<ExportedSensorValue>())

        // return
        return Promise.resolve(dataset);
    })
}
export const createExcelWorkbook = (dataset : Array<ExportedSensorValue>) : Buffer => {
    const report = excel.buildExport([
        {
        "name": 'Export Data',
        "specification": specification,
        "data": dataset
        }
    ]);
    return report;
}
