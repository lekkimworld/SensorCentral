import * as uiutils from "../ui-utils";
import moment, {Moment} from "moment";

export const ID_SAMPLES_DIV = "samples";
export const ID_SAMPLES_TABLE = "samples_table";

type QueryData = {
    start: Moment;
    end: Moment;
    groupBy: "hour" | "day" | "week" | "month" | "year";
}
let chartCtx;
let queryData : QueryData;
let queryAddMissingTimeSeries;

export type SensorDetails = {
    actionManualSample: boolean,
    buildUI: (elemRoot, sensor) => void
}

export const createSamplesTable = (elemRoot: HTMLElement) => {
    // create div's for samples table and load samples
    elemRoot.append(uiutils.htmlSectionTitle("Samples"));
    elemRoot.append(`<div id="${ID_SAMPLES_DIV}"><div id="${ID_SAMPLES_TABLE}"></div></div>`);
}

export const samplesTable = (sensor, samples) => {
    if (!samples || !samples.length) return;
    const samplesDiv = $(`#${ID_SAMPLES_DIV}`);
    const samplesTable = $(`#${ID_SAMPLES_TABLE}`);
    const isXDate = samples[0].x.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/);

    // get sample count
    samplesTable.html("");
    uiutils.appendDataTable(samplesTable, {
        "id": ID_SAMPLES_TABLE,
        "headers": isXDate ? ["DATE", "TIME", "VALUE"] : ["TIME", "VALUE"],
        "rows": samples.map(s => {
                if (isXDate) {
                    s.moment = moment(s.x);
                }
                return s;
            }).toSorted((a, b) => {
                if (!isXDate) return 0;
                return b.moment.diff(a.moment);
            }).map(s => {
                return {
                    "data": s,
                    "columns": isXDate ? [s.moment.format("DD/MM-YYYY"), s.moment.format("HH:mm"), s.y] : [s.x, s.y]
                }
            })
    });
    return Promise.resolve();
}
