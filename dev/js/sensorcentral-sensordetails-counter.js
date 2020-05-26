const uiutils = require("./ui-utils");
const $ = require("jquery");
const fetcher = require("./fetch-util");
const {barChart} = require("./charts-util");
const moment = require("moment");
const dateutils = require("./date-utils");

const ID_CHART = "sensorChart";
const ID_SAMPLES_DIV = "samples";
const ID_SAMPLES_TABLE = "samples_table";

let adjust = 0;
let queryName = "counterQueryDay";

const samplesTable = (sensor, samples) => {
    const samplesDiv = $(`#${ID_SAMPLES_DIV}`);
    const samplesTable = $(`#${ID_SAMPLES_TABLE}`);

    // get sample count
    samplesTable.html("");
    uiutils.appendDataTable(samplesTable, {
        "id": ID_SAMPLES_TABLE,
        "headers": ["PERIOD", "VALUE"],
        "rows": samples.map(s => {
            return {
                "data": s,
                "columns": [s.name, s.value]
            }
        })
    });
    return Promise.resolve();
}

module.exports = {
    actionManualSample: false, 
    "buildUI": (elemRoot, sensor) => {
        const doChart = () => {
            fetcher.graphql(`{${queryName}(data: {sensorIds: ["${sensor.id}"], adjust: ${Math.abs(adjust)}}){id, name, data{name,value}}}`).then(result => {
                const data = result[queryName][0];
                barChart(
                    ID_CHART, 
                    result[queryName][0].data.map(d => d.name),
                    result[queryName]);
                
                    samplesTable(sensor, result[queryName][0].data)
            })
        }

        // create div for graph
        elemRoot.append(uiutils.htmlSectionTitle("Graph"));
        elemRoot.append(`<div class="btn-group" role="group" aria-label="Queries" id="counter-queries">
            <button type="button" class="btn btn-secondary" rel="minus">&lt;&lt;</button>
            <button type="button" class="btn btn-secondary" rel="counterQueryDay">Day</button>
            <button type="button" class="btn btn-secondary" rel="counterQueryCalWeek">Week</button>
            <button type="button" class="btn btn-secondary" rel="counterQuery7Days">7 days</button>
            <button type="button" class="btn btn-secondary" rel="counterQueryMonth">Month</button>
            <button type="button" class="btn btn-secondary" rel="plus">&gt;&gt;</button>
        </div>`);
        elemRoot.append(`<canvas id="${ID_CHART}" width="${window.innerWidth - 20}px" height="300px"></canvas>`);

        // create div's for samples table and load samples
        elemRoot.append(uiutils.htmlSectionTitle("Chart Data"));
        elemRoot.append(`<div id="${ID_SAMPLES_DIV}"><div id="${ID_SAMPLES_TABLE}"></div></div>`);

        // create chart
        doChart();

        $("#counter-queries").click(ev => {
            const rel = ev.target.getAttribute("rel");
            if (rel === "minus") {
                adjust--;
            } else if (rel === "plus") {
                adjust++;
                if (adjust > 0) adjust = 0;
            } else {
                queryName = rel;
                adjust = 0;
            }
            doChart();
        })
    }
}
