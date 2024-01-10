import moment, { Moment } from "moment";
import { ChartAction, PowerDataDownloadOptions, SensorDataDownloadOptions, addChartContainer } from "../charting/charting";
import { graphql } from "../fetch-util";
import { DataSet } from "../ui-helper";
import TimelineSaveAction from "../charting/actions/sensordata-save-action";
import DateIntervalAction from "../charting/actions/date-interval-action";
import DateAction from "../charting/actions/date-action";
import RefreshAction from "../charting/actions/refresh-action";
import PowerdataSaveAction from "../charting/actions/powerdata-save-action";

export default async (elemRoot: JQuery<HTMLElement>) => {
    const groupedChart = addChartContainer(elemRoot, {
        title: "Grouped Query",
        type: "bar",
        actions: [
            new RefreshAction(),
            new DateIntervalAction(),
            new class extends TimelineSaveAction {
                protected getDownloadOptions(containerData: any) : SensorDataDownloadOptions {
                    return {
                        start: containerData.start,
                        end: containerData.end,
                        type: "grouped",
                        sensorIds: ["s0heatpump"],
                        applyScaleFactor: false,
                        output: "excel",
                    } as SensorDataDownloadOptions;
                }
            }
        ],
        data: async (containerData) => {
            if (!containerData.start) {
                // set initial date interval
                containerData.start = moment
                    .utc()
                    .set("year", 2023)
                    .set("month", 10)
                    .set("date", 13)
                    .set("hour", 23)
                    .set("minute", 0)
                    .set("second", 0);
                containerData.end = containerData.start.clone().add(1, "day");
            }

            // load data
            const response = await graphql(
                `{dataGroupedDateQuery(filter: {sensorIds: ["s0heatpump"], start: "${containerData.start.toISOString()}", end: "${containerData.end.toISOString()}"}, grouping: {groupBy: hour}, format: {addMissingTimeSeries: false}){id, name, data{x,y}}}`
            );
            const dataset = response.dataGroupedDateQuery[0] as DataSet;
            return [dataset];
        }
    });

    const ungroupedChart = addChartContainer(elemRoot, {
        title: "Ungrouped Query",
        type: "line",
        timeseries: true,
        actions: [
            new DateIntervalAction(),
            new class extends TimelineSaveAction {
                protected getDownloadOptions(containerData: any): SensorDataDownloadOptions {
                    return {
                        start: containerData.start,
                        end: containerData.end,
                        type: "ungrouped",
                        sensorIds: ["s0heatpump"],
                        applyScaleFactor: true,
                        output: "excel",
                    } as SensorDataDownloadOptions;
                }
            }
        ],
        data: async (containerData) => {
            if (!containerData.start) {
                // set initial date interval
                containerData.start = moment
                    .utc()
                    .set("year", 2023)
                    .set("month", 10)
                    .set("date", 13)
                    .set("hour", 23)
                    .set("minute", 0)
                    .set("second", 0);
                containerData.end = containerData.start.clone().add(1, "day");
            }

            // load data
            const response = await graphql(
                `{dataUngroupedDateQuery(filter: {sensorIds: ["s0heatpump"], start: "${containerData.start.toISOString()}", end: "${containerData.end.toISOString()}"}, format: {applyScaleFactor: false}){id, name, data{x,y}}}`
            );
            const dataset = response.dataUngroupedDateQuery[0] as DataSet;
            return [dataset];
        },
    });

    const powerpriceChart1 = addChartContainer(elemRoot, {
        title: "Power prices (today)",
        type: "bar",
        actions: [
            new DateAction(),
            new class extends PowerdataSaveAction {
                protected getDownloadOptions(containerData: any): PowerDataDownloadOptions {
                    const m = containerData.date as Moment;
                    return {
                        output: "excel",
                        type: "power",
                        dates: [m]
                    }
                }
            }
        ],
        data: async (containerData) => {
            if (!containerData.date) {
                // set initial date
                containerData.date = moment
                    .utc()
                    .set("hour", 0)
                    .set("minute", 0)
                    .set("second", 0)
                    .set("millisecond", 0);
            }

            // format date and get data
            const m = containerData.date as Moment;
            const strdate = m.format("YYYY-MM-DD");
            const powerquery = `{powerPriceQuery(filter: {date: "${strdate}"}){id,name,fromCache,data{x,y}}}`;
            const response = await graphql(powerquery);

            // return
            return [response.powerPriceQuery as DataSet];
        },
    });

    
    const powerpriceChart2 = addChartContainer(elemRoot, {
        title: "Power prices (two dates)",
        type: "bar",
        actions: [
            new class extends PowerdataSaveAction {
                protected getDownloadOptions(containerData: any): PowerDataDownloadOptions {
                    return {
                        output: "excel",
                        type: "power",
                        dates: [containerData.date1 as Moment, containerData.date2 as Moment, containerData.date3 as Moment]
                    }
                }
            }
        ],
        data: async (containerData) => {
            if (!containerData.date1) {
                // set initial date
                containerData.date1 = moment
                    .utc()
                    .set("hour", 0)
                    .set("minute", 0)
                    .set("second", 0)
                    .set("millisecond", 0);
                containerData.date2 = moment
                    .utc()
                    .set("hour", 0)
                    .set("minute", 0)
                    .set("second", 0)
                    .set("millisecond", 0)
                    .subtract(1, "day");
                containerData.date3 = moment
                    .utc()
                    .set("hour", 0)
                    .set("minute", 0)
                    .set("second", 0)
                    .set("millisecond", 0)
                    .subtract(2, "day");
            }

            const formatDate = (date: Moment) => {
                return date.format("YYYY-MM-DD");
            };

            // format date and get data
            const strdate1 = formatDate(containerData.date1);
            const powerquery1 = `{powerPriceQuery(filter: {date: "${strdate1}"}){id,name,fromCache,data{x,y}}}`;
            const response1 = await graphql(powerquery1);

            const strdate2 = formatDate(containerData.date2);
            const powerquery2 = `{powerPriceQuery(filter: {date: "${strdate2}"}){id,name,fromCache,data{x,y}}}`;
            const response2 = await graphql(powerquery2);

            const strdate3 = formatDate(containerData.date3);
            const powerquery3 = `{powerPriceQuery(filter: {date: "${strdate3}"}){id,name,fromCache,data{x,y}}}`;
            const response3 = await graphql(powerquery3);

            // return
            return [
                response1.powerPriceQuery as DataSet,
                response2.powerPriceQuery as DataSet,
                response3.powerPriceQuery as DataSet,
            ];
        }
    });
    
    const lineChart = addChartContainer(elemRoot, {
        title: `Test dataset`,
        type: "line",
        timeseries: true,
        adjustMinimumY: -0.5,
        adjustMaximumY: 0.5,
        actions: [
            new RefreshAction(),
            new DateIntervalAction(),
            new class extends TimelineSaveAction {
                protected getDownloadOptions(containerData: any): SensorDataDownloadOptions {
                    return {
                        output: "excel",
                        type: "ungrouped",
                        start: containerData.start,
                        end: containerData.end,
                        sensorIds: ["840D8E8966E9_temp", "840D8E8966E9_hum"],
                    };
                }

            }
        ],
        data: async (containerData) => {
            if (!containerData.start) {
                // set initial date interval
                containerData.start = moment
                    .utc()
                    .set("year", 2023)
                    .set("month", 10)
                    .set("date", 13)
                    .set("hour", 23)
                    .set("minute", 0)
                    .set("second", 0);
                containerData.end = containerData.start.clone().add(1, "day");
            }

            // load data
            const response = await graphql(
                `{dataUngroupedDateQuery(filter: {sensorIds: ["840D8E8966E9_temp", "840D8E8966E9_hum"], start: "${containerData.start.toISOString()}", end: "${containerData.end.toISOString()}"}, format: {decimals: 2, applyScaleFactor: false}){id, name, data{x,y}}}`
            );
            const dataset1 = response.dataUngroupedDateQuery[0] as DataSet;
            const dataset2 = response.dataUngroupedDateQuery[1] as DataSet;
            return [dataset1, dataset2];
        }
    });
};
