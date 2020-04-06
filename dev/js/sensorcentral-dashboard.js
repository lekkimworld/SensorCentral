const $ = require("jquery");
const doChart = require("./charts-util").doChart;
const uiutils = require("./ui-utils");
const fetcher = require("./fetch-util");

module.exports = (document, elemRoot) => {
    const header = uiutils.htmlTitleRow("Dashboards");
    elemRoot.html(`${header}
    <canvas id="myChart" width="600px" height="250px"></canvas>`
    )

    const sensorid = "sensor_foo";
    const sensorname = "foo";
    const samples = fetcher.getSamples(sensorid, 800).then(samples => {
        doChart("myChart", sensorname, samples);
        /*
        const arr = samples.reverse().map(sample => {
            return {
                "x": new Date(sample.dt),
                "y": sample.value
            }
        })
        const formatDate = d => {
            const m = d.getMonth();
            const month = m===0 ? "jan" : m===1 ? "feb" : m === 2 ? "mar" : "apr";
            return `${d.getDate()} ${month}`;
        }
        const formatTime = d => {
            return `${d.getHours() < 10 ? "0" + d.getHours() : d.getHours()}:${d.getMinutes() < 10 ? "0" + d.getMinutes() : d.getMinutes()}`;
        }
        doChart({
            "labels": arr.map(d => `${formatDate(d.x)} ${formatTime(d.x)}`),
            "datasets": [{
                "label": sensorname,
                "data": arr,
                "pointRadius": 0,
                "fill": false,
                "backgroundColor": 'rgba(0, 100, 255, 0.4)'
            }]}, 
            "line", {
                "responsive": false
            }
        );
        */
    })
}