const uiutils = require("./ui-utils");
const $ = require("jquery");
const fetcher = require("./fetch-util");
const { addChartContainer } = require("./charts-util");
const moment = require("moment");
const dateutils = require("./date-utils");

const ID_SAMPLES_DIV = "samples";
const ID_SAMPLES_TABLE = "samples_table";

let chartCtx;
let queryData;
let queryAddMissingTimeSeries;

const samplesTable = (sensor, samples) => {
    const samplesDiv = $(`#${ID_SAMPLES_DIV}`);
    const samplesTable = $(`#${ID_SAMPLES_TABLE}`);

    const isXDate = samples[0].x.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/);

    // get sample count
    samplesTable.html("");
    uiutils.appendDataTable(samplesTable, {
        "id": ID_SAMPLES_TABLE,
        "headers": isXDate ? ["DATE", "TIME", "VALUE"] : ["TIME", "VALUE"],
        "rows": samples.map(s => {
            return {
                "data": s,
                "columns": isXDate ? [moment(s.x).format("DD/MM-YYYY"), moment(s.x).format("HH:mm"), s.y] : [s.x, s.y]
            }
        })
    });
    return Promise.resolve();
}

module.exports = {
    "createGaugeChart": (elemRoot, sensor, options = {}) => {
        // create div for graph
        const chartCtx = addChartContainer(elemRoot, Object.assign({}, {
            "actions": ["INTERVAL", "DOWNLOAD"],
            "callback": (action, samples) => {
                samplesTable(sensor, samples[0].data);
            }
        }, options));

        // create div's for samples table and load samples
        elemRoot.append(uiutils.htmlSectionTitle("Chart Data"));
        elemRoot.append(`<div id="${ID_SAMPLES_DIV}"><div id="${ID_SAMPLES_TABLE}"></div></div>`);

        // build chart
        chartCtx.gaugeChart({
            "sensors": [sensor]
        }).then(samples => {
            samplesTable(sensor, samples[0].data);
        })
    },
    "createBuildUIFunctionWithQueryName": (queryName) => (elemRoot, sensor) => {
        const doChart = () => {
            fetcher.graphql(`{${queryName}(data: {sensorIds: ["${sensor.id}"], groupBy: ${queryData.groupBy}, adjustBy: ${queryData.adjustBy}, start: ${queryData.start}, end: ${queryData.end}, addMissingTimeSeries: ${queryAddMissingTimeSeries}}){id, name, data{x,y}}}`).then(result => {
                const querydata = result[queryName][0];
                chartCtx.barChart(
                    querydata.data.map(d => d.x), {
                        "dataset": {
                            "label": sensor.name,
                            "data": querydata.data.map(d => d.y)
                        }
                    }
                )
                return Promise.resolve(querydata.data);

            }).then(samples => {
                samplesTable(sensor, samples)
            })
        }

        // create div for graph
        elemRoot.append(uiutils.htmlSectionTitle("Graph"));
        elemRoot.append(`
<div class="clear w-100" id="querySelectors">
<div class="dropdown float-left ml-1 mt-1 w-100">
    <button class="btn btn-secondary dropdown-toggle w-100" type="button" id="dropdownGroupby" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
        Group by (hour)
    </button>
    <div class="dropdown-menu" rel="groupBy" aria-labelledby="dropdownGroupby">
        <a class="dropdown-item" href="javascript:void(0)" rel="hour">Hour</a>
        <a class="dropdown-item" href="javascript:void(0)" rel="day">Day</a>
        <a class="dropdown-item" href="javascript:void(0)" rel="week">Week</a>
        <a class="dropdown-item" href="javascript:void(0)" rel="month">Month</a>
        <a class="dropdown-item" href="javascript:void(0)" rel="year">Year</a>
    </div>
</div>
<div class="dropdown float-left ml-1 mt-1 w-100">
    <button class="btn btn-secondary dropdown-toggle w-100" type="button" id="dropdownAdjustby" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
        Adjust by (day)
    </button>
    <div class="dropdown-menu" rel="adjustBy" aria-labelledby="dropdownAdjustby">
        <a class="dropdown-item" href="javascript:void(0)" rel="day">Day</a>
        <a class="dropdown-item" href="javascript:void(0)" rel="week">Week</a>
        <a class="dropdown-item" href="javascript:void(0)" rel="month">Month</a>
        <a class="dropdown-item" href="javascript:void(0)" rel="year">Year</a>
    </div>
</div>
<div class="dropdown float-left ml-1 mt-1 w-100">
    <button class="btn btn-secondary dropdown-toggle w-100" type="button" id="dropdownStart" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
        Start (Current)
    </button>
    <div class="dropdown-menu" rel="start" aria-labelledby="dropdownStart">
    <a class="dropdown-item" href="javascript:void(0)" rel="0">Current</a>
    <a class="dropdown-item" href="javascript:void(0)" rel="1">Previous</a>
    <a class="dropdown-item" href="javascript:void(0)" rel="2">2 back</a>
    <a class="dropdown-item" href="javascript:void(0)" rel="3">3 back</a>
    </div>
</div>
<div class="dropdown float-left ml-1 mt-1 w-100">
    <button class="btn btn-secondary dropdown-toggle w-100" type="button" id="dropdownEnd" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
        End (Current)
    </button>
    <div class="dropdown-menu" rel="end" aria-labelledby="dropdownEnd">
        <a class="dropdown-item" href="javascript:void(0)" rel="-1">Current</a>
        <a class="dropdown-item" href="javascript:void(0)" rel="0">Previous</a>
        <a class="dropdown-item" href="javascript:void(0)" rel="1">2 back</a>
        <a class="dropdown-item" href="javascript:void(0)" rel="2">3 back</a>
    </div>
</div>
</div>
        
        `);
        chartCtx = addChartContainer(elemRoot, { append: true });

        // add selector for adding missing time series and for applying scale factor
        elemRoot.append(`<p class="mt-3">
        <label for="add_missing_dtseries">Add missing time-series</label>
        <label class="sensorcentral-switch">
            <input type="checkbox" id="add_missing_dtseries" value="1">
            <span class="sensorcentral-slider sensorcentral-round"></span>
        </label>
        </p>`);

        // add selector 
        elemRoot.append(`<p class="mt-3"></p>`);

        // create div's for samples table and load samples
        elemRoot.append(uiutils.htmlSectionTitle("Chart Data"));
        elemRoot.append(`<div id="${ID_SAMPLES_DIV}"><div id="${ID_SAMPLES_TABLE}"></div></div>`);

        $("#add_missing_dtseries").on("click", ev => {
            const add_missing = ev.target.checked;
            queryAddMissingTimeSeries = add_missing;

            // refresh chart
            doChart();
        })
        $("#querySelectors").on("click", ev => {
            const linkRel = ev.target.getAttribute("rel");
            const typeRel = ev.target.parentNode.getAttribute("rel");
            if (!linkRel || !typeRel) return;
            console.log(`linkRel <${linkRel}> typeRel <${typeRel}>`);

            let prevSib = ev.target.parentNode.previousSibling;
            while (prevSib.localName !== "button") {
                prevSib = prevSib.previousSibling;
            }
            prevSib.innerText = `${prevSib.innerText.split("(")[0]} (${ev.target.innerText})`;

            // update query daya
            queryData[typeRel] = linkRel;

            // refresh chart
            doChart();
        })

        // set defaults to query data
        queryData = {
            "start": 0,
            "end": -1,
            "adjustBy": "day",
            "groupBy": "hour"
        }
        queryAddMissingTimeSeries = false;

        // create chart
        doChart();
    }
}