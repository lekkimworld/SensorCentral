const uiutils = require("./ui-utils");
const $ = require("jquery");
const fetcher = require("./fetch-util");
const { addChartContainer, buildGaugeChart } = require("./charts-util");
const moment = require("moment");
const dateutils = require("./date-utils");
const { data } = require("jquery");

const ID_SAMPLES_DIV = "samples";
const ID_SAMPLES_TABLE = "samples_table";
const ID_SAMPLES_LINK = "samples_link";
const SAMPLE_COUNT_LOAD = 50;
const SAMPLE_COUNT_INCR = 10;

let chartCtx;
let lastSamplesQueryCount = undefined;

const samplesTable = (sensor, samplesInput) => {
    const samplesDiv = $(`#${ID_SAMPLES_DIV}`);
    const samplesTable = $(`#${ID_SAMPLES_TABLE}`);
    const samples = Array.isArray(samplesInput) ? samplesInput[0] : samplesInput;

    // get sample count
    samplesTable.html("");
    uiutils.appendDataTable(samplesTable, {
        "id": ID_SAMPLES_TABLE,
        "headers": ["DATE/TIME", "VALUE"],
        "rows": samples.data.map(s => {
            return {
                "data": s,
                "columns": [dateutils.formatDMYTime(s.x), s.y]
            }
        })
    });
    return Promise.resolve();
}

const buildChartAndTable = (sensor) => {
    chartCtx.gaugeChart({ "sensors": [sensor] }).then(samples => {
        if (!samples) return;
        samplesTable(sensor, samples);
    })
}

module.exports = {
    buildUI: (elemRoot, sensor) => {
        // clear page
        lastSamplesQueryCount = undefined;

        // create div for graph
        chartCtx = addChartContainer(elemRoot, {
            "actions": ["INTERVAL", "DOWNLOAD"],
            "callback": (action, data) => {
                samplesTable(sensor, data);
            }
        });

        // create div's for samples table and load samples
        elemRoot.append(uiutils.htmlSectionTitle("Samples"));
        elemRoot.append(`<div id="${ID_SAMPLES_DIV}"><div id="${ID_SAMPLES_TABLE}"></div></div>`);

        // show chart and table
        buildChartAndTable(sensor);
    },

    updateUI: (sensor, body) => {
        buildChartAndTable(sensor);
    }
}