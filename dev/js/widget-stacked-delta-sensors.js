const fetcher = require("./fetch-util");
const { addChartContainer, barChart } = require("./charts-util");
const moment = require("moment");
const uiutils = require("./ui-utils");

module.exports = (elem) => {
    // load sensor data
    fetcher.graphql(`query {
        sensors(data: {type: delta}){id,name}
    }
    `).then(data => {
        if (data.sensors.length === 0) {
            // no delta sensors
        } else {

            const chartCtx = addChartContainer(elem, { title: "Stacked Delta Sensors (this week)" });
            return fetcher.graphql(`query {
                groupedQuery(data: {sensorIds: ["${data.sensors.map(s => s.id).join("\",\"")}"], groupBy: day, adjustBy: week, start: 0, end: -1, addMissingTimeSeries: true}){id, name, data{x,y}}
            }`).then(data => {
                const datasets = data.groupedQuery.map(q => {
                    return {
                        "label": q.name,
                        "data": q.data.map(d => d.y)
                    }
                })
                const labels = data.groupedQuery[0].data.map(d => d.x);

                chartCtx.barChart(labels, {
                    "datasets": datasets,
                    "stacked": true
                })
            })
        }
    })
}