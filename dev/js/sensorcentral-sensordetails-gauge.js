const uiutils = require("./ui-utils");
const $ = require("jquery");
const fetcher = require("./fetch-util");
const {lineChart} = require("./charts-util");
const moment = require("moment");
const dateutils = require("./date-utils");
const { data } = require("jquery");

const ID_CHART = "sensorChart";
const ID_SAMPLES_DIV = "samples";
const ID_SAMPLES_TABLE = "samples_table";
const ID_SAMPLES_LINK = "samples_link";
const ATTR_SAMPLES_COUNT = "sample_count";
const SAMPLE_COUNT_LOAD = 50;
const SAMPLE_COUNT_INCR = 10;
const SAMPLE_COUNT_INITIAL_TABLE = 25;

let lastSamplesQueryCount = undefined;

const loadSamples = (sensorId) => {
    // see how many samples we need to get
    const samplesCount = lastSamplesQueryCount ? lastSamplesQueryCount + SAMPLE_COUNT_INCR : SAMPLE_COUNT_LOAD;
    
    return fetcher.graphql(`{ungroupedQuery(data: {sensorIds: ["${sensorId}"], decimals: 2, sampleCount: ${SAMPLE_COUNT_LOAD}}){id, name, data{x,y}}}`).then(result => {
        const samples = result["ungroupedQuery"][0];
        lastSamplesQueryCount = samplesCount;
        return Promise.resolve(samples);
    })
}

const samplesChart = (sensor, samples) => {
    lineChart(ID_CHART, sensor.name, samples);
}

const samplesTable = (sensor, samples) => {
    const samplesDiv = $(`#${ID_SAMPLES_DIV}`);
    const samplesTable = $(`#${ID_SAMPLES_TABLE}`);

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

module.exports = {
    buildUI: (elemRoot, sensor) => {
        // clear page
        elemRoot.html("");
        lastSamplesQueryCount = undefined;

        // add link to load more data
        elemRoot.append(`<div id="${ID_SAMPLES_LINK}" class="float-right"><a href="javascript:void(0)">Load Earlier Data</a></div>`);

        // create div for graph
        elemRoot.append(uiutils.htmlSectionTitle("Graph"));
        elemRoot.append(`<canvas id="${ID_CHART}" width="${window.innerWidth - 20}px" height="300px"></canvas>`);
        
        // create div's for samples table and load samples
        elemRoot.append(uiutils.htmlSectionTitle("Samples"));
        elemRoot.append(`<div id="${ID_SAMPLES_DIV}" ${ATTR_SAMPLES_COUNT}="0"><div id="${ID_SAMPLES_TABLE}"></div></div>`);

        loadSamples(sensor.id).then(samples => {
            samplesChart(sensor, samples);
            samplesTable(sensor, samples);
        }).then(() => {
            // add link to load more
            $(`#${ID_SAMPLES_LINK}`).on("click", () => {
                loadSamples(sensor.id).then(samples => {
                    samplesChart(sensor, samples);
                    samplesTable(sensor, samples);
                })
            })
        });
    },
    
    updateUI: (sensor, body) => {
        // add to cache
        samplesCache.push(body);

        // rebuild chart and table
        samplesChart(sensor, samplesCache);
        samplesTable(sensor, samplesCache);
    }
}
