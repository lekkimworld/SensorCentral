import { graphql } from "../fetch-util";
import { addChartContainer } from "../../js/charts-util";
import * as storageutils from "../storage-utils";

export default async (elem: JQuery<HTMLElement>) => {
    // get favorite sensors in the currently selected house
    const user = storageutils.getUser();
    graphql(`query {
        sensors(data: {type: delta, houseId: "${user.houseId}"}){id,name}
    }
    `, {"noSpinner": true}).then(data => {
        if (data.sensors.length === 0) {
            // no delta sensors
        } else {

            const chartCtx = addChartContainer(elem, { title: "Stacked Delta Sensors (this week)" });
            return graphql(
                    `query {
                dataGroupedOffsetQuery(filter: {sensorIds: ["${data.sensors
                    .map((s) => s.id)
                    .join(
                        '","'
                    )}"], adjustBy: week, start: 0, end: -1}, grouping: {groupBy: day}, format: {addMissingTimeSeries: true}){id, name, data{x,y}}
            }`,
                    { noSpinner: true }
                )
                .then((data) => {
                    const datasets = data.dataGroupedOffsetQuery.map((q) => {
                        return {
                            label: q.name,
                            data: q.data.map((d) => d.y),
                        };
                    });
                    const labels = data.dataGroupedOffsetQuery[0].data.map((d) => d.x);

                    chartCtx.barChart(labels, {
                        datasets: datasets,
                        stacked: true,
                    });
                });
        }
    })
}