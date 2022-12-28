import { SensorDetails, createGaugeChart, createBuildUIFunctionWithQueryName } from "./sensordetails-base";

const ungroupedChart = createBuildUIFunctionWithQueryName("dataGroupedOffsetQuery");
let chartType;
const bar = (sensor) => {
    const e = $("#deltasensor-ui");
    e.html("");
    ungroupedChart(e, sensor)
    chartType = "bar";
}
const gauge = (sensor) => {
    const e = $("#deltasensor-ui");
    e.html("");
    createGaugeChart(e, sensor);
    chartType = "gauge";
}



export default {
    actionManualSample: false,
    buildUI: (elemRoot, sensor) => {
        elemRoot.html(`<div class="row wrap">
                <div class="col col-6"><button class="btn btn-primary w-100 mt-2" id="gauge">Line</button></div>
                <div class="col col-6"><button class="btn btn-primary w-100 mt-2" id="bar">Bar</button></div>
                </div>
                <div id="deltasensor-ui" class="mt-3"></div>`);
        $("#gauge").on("click", () => gauge(sensor));
        $("#bar").on("click", () => bar(sensor));
        if (chartType === "bar") {
            gauge(sensor);
        } else {
            bar(sensor);
        }
    }
} as SensorDetails;
