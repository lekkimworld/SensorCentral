import * as uiutils from "../../js/ui-utils";
import { addChartContainer } from "../../js/charts-util";
import { SensorDetails, samplesTable } from "./sensordetails-base";

const ID_SAMPLES_DIV = "samples";
const ID_SAMPLES_TABLE = "samples_table";

let chartCtx;
let lastSamplesQueryCount = undefined;

const buildChartAndTable = (sensor) => {
    chartCtx.gaugeChart({ "sensors": [sensor] }).then(sensorSamples => {
        if (!sensorSamples) return;
        const samples = Array.isArray(sensorSamples) ? sensorSamples[0] : sensorSamples;
        console.log("buildChartAndTable", samples);
        samplesTable(sensor, samples.data);
    })
}

export default {
    actionManualSample: true,
    buildUI: (elemRoot, sensor) => {
        // clear page
        lastSamplesQueryCount = undefined;

        // create div for graph
        chartCtx = addChartContainer(elemRoot, {
            actions: ["INTERVAL", "DOWNLOAD"],
            callback: async (action, data) => {
                if ("INTERVAL" !== action) return;

                // get dates
                const start_dt = data.start_dt;
                const end_dt = data.end_dt;

                // reload
                const samples = await chartCtx.reload({
                    start_dt, end_dt
                })

                // show samples
                samplesTable(sensor, samples.data);
            },
        });

        // create div's for samples table and load samples
        elemRoot.append(uiutils.htmlSectionTitle("Samples"));
        elemRoot.append(`<div id="${ID_SAMPLES_DIV}"><div id="${ID_SAMPLES_TABLE}"></div></div>`);

        // show chart and table
        buildChartAndTable(sensor);
    },

    updateUI: (sensor) => {
        buildChartAndTable(sensor);
    },
} as SensorDetails;




