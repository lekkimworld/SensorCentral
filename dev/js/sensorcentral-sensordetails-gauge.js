const uiutils = require("./ui-utils");
const $ = require("jquery");
const fetcher = require("./fetch-util");
const { buildGaugeChart, ID_CHART_CONTAINER } = require("./charts-util");
const moment = require("moment");
const dateutils = require("./date-utils");
const { data } = require("jquery");

const ID_SAMPLES_DIV = "samples";
const ID_SAMPLES_TABLE = "samples_table";
const ID_SAMPLES_LINK = "samples_link";
const ATTR_SAMPLES_COUNT = "sample_count";
const SAMPLE_COUNT_LOAD = 50;
const SAMPLE_COUNT_INCR = 10;
const SAMPLE_COUNT_INITIAL_TABLE = 25;

let lastSamplesQueryCount = undefined;

const samplesTable = (sensor, samplesInput) => {
    const samplesDiv = $(`#${ID_SAMPLES_DIV}`);
    const samplesTable = $(`#${ID_SAMPLES_TABLE}`);
    const samples = Array.isArray(samplesInput) ? samplesInput[0] : samplesInput;

    // get sample count
    samplesCount = Number.parseInt(samplesDiv.attr(ATTR_SAMPLES_COUNT)) + SAMPLE_COUNT_INCR;
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
    $(`#${ID_SAMPLES_DIV}`).attr(ATTR_SAMPLES_COUNT, samplesCount);
    return Promise.resolve();
}

const buildChartAndTable = (sensor, initial = false) => {
    const samplesCount = lastSamplesQueryCount ? lastSamplesQueryCount + SAMPLE_COUNT_INCR : SAMPLE_COUNT_LOAD;
    lastSamplesQueryCount = samplesCount;

    buildGaugeChart({ "sensors": [sensor], "samplesCount": samplesCount }).then(samples => {
        if (!samples) return;
        samplesTable(sensor, samples);

        if (initial) {
            // add link to load more
            $(`#${ID_SAMPLES_LINK}`).on("click", () => {
                buildChartAndTable(sensor, false);
            })
        }
    })
}

module.exports = {
    buildUI: (elemRoot, sensor) => {
        // clear page
        elemRoot.html("");
        lastSamplesQueryCount = undefined;

        // add link to load more data
        elemRoot.append(`<div id="${ID_SAMPLES_LINK}" class="float-right"><a href="javascript:void(0)">Load Earlier Data</a></div>`);

        // create div for graph
        elemRoot.append(uiutils.htmlSectionTitle("Graph"));
        elemRoot.append(`<div id="${ID_CHART_CONTAINER}"></div>`);

        // create div's for samples table and load samples
        elemRoot.append(uiutils.htmlSectionTitle("Samples"));
        elemRoot.append(`<div id="${ID_SAMPLES_DIV}" ${ATTR_SAMPLES_COUNT}="0"><div id="${ID_SAMPLES_TABLE}"></div></div>`);

        // show chart and table
        buildChartAndTable(sensor, true);
    },

    updateUI: (sensor, body) => {
        buildChartAndTable(sensor, true);
    }
}