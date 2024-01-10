import { graphql } from "../fetch-util";
import * as storageutils from "../storage-utils";
import {addChartContainer} from "../charting/charting";
import RefreshAction from "../charting/actions/refresh-action";
import { DataSet } from "../ui-helper";

export default async (elem: JQuery<HTMLElement>) => {
    // get delta sensors in the currently selected house
    const user = storageutils.getUser();
    const sensorData = await graphql(`query {
        sensors(data: {type: delta, houseId: "${user.houseId}"}){id,name}
    }`, { noSpinner: true });
    const sensorIds = sensorData.sensors.map(s => s.id);

    addChartContainer(elem, {
        title: "Stacked Delta Sensors (this week)",
        type: "stacked-bar",
        actions: [
            new RefreshAction()
        ],
        async data(containerData) {
            const data = await graphql(`query {
                dataGroupedOffsetQuery(filter: {sensorIds: ["${sensorIds.join('","')}"], adjustBy: week, start: 0, end: -1}, grouping: {groupBy: day}, format: {addMissingTimeSeries: true}){id, name, data{x,y}}
            }`, { noSpinner: true });

            // build a dataset per sensor
            return data.dataGroupedOffsetQuery as Array<DataSet>;
        },
    });
}