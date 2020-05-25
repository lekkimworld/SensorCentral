const uiutils = require("./ui-utils");
const $ = require("jquery");
const fetcher = require("./fetch-util");
const {barChart} = require("./charts-util");
const moment = require("moment");
const dateutils = require("./date-utils");

const ID_CHART = "sensorChart";

module.exports = {
    actionManualSample: false, 
    "buildUI": (elemRoot, sensor) => {
        const doChart = (query) => {
            fetcher.graphql(`{${query}(data: {sensorIds: ["${sensor.id}"], adjust: 0}){id, name, data{name,value}}}`).then(result => {
                const data = result[query][0];
                barChart(
                    ID_CHART, 
                    result[query][0].data.map(d => d.name),
                    result[query]);
            })
        }

        // create div for graph
        elemRoot.append(uiutils.htmlSectionTitle("Graph"));
        elemRoot.append(`<div class="btn-group" role="group" aria-label="Queries" id="counter-queries">
        <button type="button" class="btn btn-secondary">Day</button>
        <button type="button" class="btn btn-secondary">Week</button>
        <button type="button" class="btn btn-secondary">Month</button>
      </div>`);
        elemRoot.append(`<canvas id="${ID_CHART}" width="${window.innerWidth - 20}px" height="300px"></canvas>`);
        
        const queries = ["counterQueryDay", "counterQueryLast7Days", "counterQueryMonth"];
        doChart(queries[0]);

        $("#counter-queries").click(ev => {
            const t = ev.target.innerText;
            if (t === "Day") {
                doChart(queries[0]);
            } else if (t === "Week") {
                doChart(queries[1]);
            } else {
                doChart(queries[2]);
            }
        })
    }
}
