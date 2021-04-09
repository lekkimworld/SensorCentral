const fetcher = require("./fetch-util");
const dateutils = require("./date-utils");
const uiutils = require("./ui-utils");
const { addChartContainer, buildGaugeChart } = require("./charts-util");

module.exports = (elem) => {
    const chartCtx = addChartContainer(elem, { title: "Favorite Gauge Sensors", actions: ["DOWNLOAD"] });

    const update = () => {
        fetcher.graphql(`{favoriteSensors(data: {type: "gauge"}){id,name,type}}`, {"noSpinner": true}).then(data => {
            chartCtx.gaugeChart({
                "sensors": data.favoriteSensors
            })
        })
    }
    update();
}