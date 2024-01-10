import { addChartContainer } from "../charting/charting";
import { SensorDetails, samplesTable, createSamplesTable } from "./sensordetails-base";
import moment, { Moment } from "moment";
import { graphql } from "../fetch-util";
import { DataSet } from "../ui-helper";
import RefreshAction from "../charting/actions/refresh-action";
import DateIntervalAction from "../charting/actions/date-interval-action";


export default {
    actionManualSample: true, 
    buildUI(elemRoot, sensor) {
        // add chart
        addChartContainer(elemRoot, {
            title: "Sensor data",
            type: "line",
            timeseries: true, 
            actions: [
                new RefreshAction(),
                new DateIntervalAction()
            ],
            async data(containerData) {
                let start: Moment;
                let end: Moment;
                if (!containerData.start) {
                    end = moment();
                    start = moment().subtract(1, "day");
                    containerData.start = start;
                    containerData.end = end;
                } else {
                    start = containerData.start as Moment;
                    end = containerData.end as Moment;
                }
                const data = await graphql(`{
                        dataUngroupedDateQuery(
                            filter: { sensorIds: ["${sensor.id}"],
                            start: "${start.toISOString()}",
                            end: "${end.toISOString()}" }
                        ) {
                            id
                            name
                            data {
                                x
                                y
                            }
                        }
                    }
                    `);
                
                // get datasets
                const datasets = data.dataUngroupedDateQuery as Array<DataSet>;

                // build samples table
                samplesTable(sensor, datasets[0].data);
                
                // return data for chart
                return datasets;
            },
        })
        
        // create div's for samples table and load samples
        createSamplesTable(elemRoot);

    },
} as SensorDetails;
