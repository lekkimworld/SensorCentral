const uiutils = require("./ui-utils");
const $ = require("jquery");
const fetcher = require("./fetch-util");
const doChart = require("./charts-util").doChart;

const ID_SAMPLES_DIV = "samples";
const ID_SAMPLES_TABLE = "samples_table";
const ID_SAMPLES_LINK = "samples_link";
const ATTR_SAMPLES_COUNT = "sample_count";
const SAMPLE_COUNT_LOAD = 50;
const SAMPLE_COUNT_INCR = 10;
const SAMPLE_COUNT_INITIAL_TABLE = 25;

let samplesCache = undefined;

const loadSamples = (sensorId) => {
    // see how many samples we need to get
    const samplesCount = samplesCache ? samplesCache.length + SAMPLE_COUNT_INCR : SAMPLE_COUNT_LOAD;
    return fetcher.getSamples(sensorId, samplesCount).then(samples => {
        samplesCache = samples;
        return Promise.resolve(samplesCache);
    });
}

const samplesChart = (sensor, samples) => {
    doChart("myChart", sensor.name, samples);
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
        "rows": samples.map(s => {
            return {
                "data": [s.dt_string, s.value]
            }
        })
    });
    $(`#${ID_SAMPLES_DIV}`).attr(ATTR_SAMPLES_COUNT, samplesCount);
    return Promise.resolve();
}

module.exports = (document, elemRoot, ctx) => {
    // fetch sensor
    fetcher.get(`/api/v1/sensors/${ctx.sensorId}`).then(sensor => {
        // create breadcrumbs
        elemRoot.html(uiutils.htmlBreadcrumbs([
            {"text": "Houses", "id": "houses"},
            {"text": sensor.device.house.name, "id": `house/${sensor.device.house.id}`},
            {"text": sensor.device.name, "id": `house/${sensor.device.house.id}/device/${sensor.device.id}`},
            {"text": sensor.name}
        ]));

        // create title row
        uiutils.appendTitleRow(
            elemRoot, 
            `Sensor: ${sensor.name}`, 
            [{"rel": "create", "icon": "plus", "click": (action) => {
                
            }}]
        );

        // create div for graph
        elemRoot.append(uiutils.htmlSectionTitle("Graph"));
        elemRoot.append(`<canvas id="myChart" width="650px" height="250px"></canvas>`);
        
        // create div's for samples table and load samples
        elemRoot.append(uiutils.htmlSectionTitle("Samples"));
        elemRoot.append(`<div id="${ID_SAMPLES_DIV}" ${ATTR_SAMPLES_COUNT}="0"><div id="${ID_SAMPLES_LINK}"><a href="javascript:void(0)">Load More</a></div><div id="${ID_SAMPLES_TABLE}"></div></div>`);

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
        
    })
    
}
