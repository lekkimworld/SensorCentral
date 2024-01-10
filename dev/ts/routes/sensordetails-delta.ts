import { SensorDetails, createSamplesTable, samplesTable } from "./sensordetails-base";
import { addChartContainer } from "../charting/charting";
import { graphql } from "../fetch-util";
import { DataSet } from "../ui-helper";
import moment, { Moment } from "moment";
import RefreshAction from "../charting/actions/refresh-action";
import DateIntervalAction from "../charting/actions/date-interval-action";

// use state across change of chart types
let end: Moment = moment().set("hour", 24).set("minute", 0).set("second", 0);
let start: Moment = end.clone().subtract(1, "day");

const grouped = (sensor) => {
    const e = $("#deltasensor-ui");

    addChartContainer(e, {
        replaceHtml: true,
        timeseries: false,
        title: "Data grouped by hour",
        type: "bar",
        actions: [new RefreshAction(), new DateIntervalAction()],
        async data(containerData) {
            // use state across change of chart types
            if (!containerData.start) {
                containerData.start = start;
                containerData.end = end;
            } else {
                start = containerData.start;
                end = containerData.end;
            }

            // load data
            const response = await graphql(
                `{dataGroupedDateQuery(filter: {sensorIds: ["${
                    sensor.id
                }"], start: "${containerData.start.toISOString()}", end: "${containerData.end.toISOString()}"}, grouping: {groupBy: hour}, format: {addMissingTimeSeries: false}){id, name, data{x,y}}}`
            );
            const dataset = response.dataGroupedDateQuery[0] as DataSet;

            samplesTable(sensor, dataset.data);

            return [dataset];
        },
    });
};
const ungrouped = (sensor) => {
    const e = $("#deltasensor-ui");
    
    addChartContainer(e, {
        replaceHtml: true,
        timeseries: true,
        title: "Ungrouped data",
        type: "line",
        actions: [new RefreshAction(), new DateIntervalAction()],
        async data(containerData) {
            // use state across change of chart types
            if (!containerData.start) {
                containerData.start = start;
                containerData.end = end;
            } else {
                start = containerData.start;
                end = containerData.end;
            }

            // load data
            const response = await graphql(
                `{dataUngroupedDateQuery(filter: {sensorIds: ["${
                    sensor.id
                }"], start: "${containerData.start.toISOString()}", end: "${containerData.end.toISOString()}"}){id, name, data{x,y}}}`
            );
            const dataset = response.dataUngroupedDateQuery[0] as DataSet;
            return [dataset];
        },
    });
};

export default {
    actionManualSample: false,
    buildUI: (elemRoot, sensor) => {
        elemRoot.html(`<div class="row wrap">
                <div class="col col-6"><button class="btn btn-primary w-100 mt-2" id="ungrouped">Ungrouped</button></div>
                <div class="col col-6"><button class="btn btn-primary w-100 mt-2" id="grouped">Grouped</button></div>
                </div>
                <div id="deltasensor-ui" class="mt-3"></div>`);
        $("#ungrouped").on("click", () => ungrouped(sensor));
        $("#grouped").on("click", () => grouped(sensor));

        // creste table for samples
        createSamplesTable(elemRoot);

        // show grouped data as default
        grouped(sensor);
    }
} as SensorDetails;
