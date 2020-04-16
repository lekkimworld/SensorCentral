const uiutils = require("./ui-utils");
const $ = require("jquery");
const fetcher = require("./fetch-util");
const doChart = require("./charts-util").doChart;
const formutils = require("./forms-util");
const moment = require("moment");

const ID_CHART = "sensorChart";
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
    doChart(ID_CHART, sensor.name, samples);
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
        "rows": samples.sort((a,b) => b.dt-a.dt).map(s => {
            return {
                "data": s,
                "columns": [s.dt_string, s.value]
            }
        })
    });
    $(`#${ID_SAMPLES_DIV}`).attr(ATTR_SAMPLES_COUNT, samplesCount);
    return Promise.resolve();
}

module.exports = (document, elemRoot, ctx) => {
    // fetch sensor
    fetcher.graphql(`{sensor(id:"${ctx.sensorId}"){id, name, device{id,name,house{id,name}}}}`).then(data => {
        const sensor = data.sensor;

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
                formutils.appendManualSampleForm(sensor, (data) => {
                    // get field values
                    let postbody = {
                        "id": sensor.id,
                        "value": data.value,
                        "deviceId": sensor.device.id,
                        "dt": data.date.toISOString()
                    }
                    fetcher.post(`/api/v1/data/samples`, postbody).then(body => {
                        // convert date to a javascript date and push in cache
                        body.dt = moment.utc(body.dt).toDate();
                        samplesCache.push(body);

                        // rebuild chart and table
                        samplesChart(sensor, samplesCache);
                        samplesTable(sensor, samplesCache);

                        
                    }).catch(err => {
                        
                    })
                })
            }}]
        );

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
        
    })
    
}
