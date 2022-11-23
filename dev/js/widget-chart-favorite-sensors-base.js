const fetcher = require("./fetch-util");
const dateutils = require("./date-utils");
const uiutils = require("./ui-utils");
const { addChartContainer, buildGaugeChart } = require("./charts-util");

module.exports = (elem, title, type) => {
    const update = () => {
        fetcher.graphql(`{favoriteSensors(data: {type: "${type}"}){id,name,type}}`, {"noSpinner": true}).then(data => {
            if (!data.favoriteSensors.length) {
                return;
            }
            const chartCtx = addChartContainer(elem, { title, actions: ["DOWNLOAD"] });
            chartCtx.gaugeChart({
                "sensors": data.favoriteSensors
            })
        })
    }
    update();
}