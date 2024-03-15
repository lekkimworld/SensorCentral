import {graphql} from "../fetch-util";
import {addChartContainer} from "../charting/charting";
import { DataElement, DataSet } from "../ui-helper";
import RefreshAction from "../charting/actions/refresh-action";

export default async (elem: JQuery<HTMLElement>, title: string, type: string) => {
    const sensors = await graphql(`{sensors(data: {favorite: yes, type: ${type}}){id,name,type}}`, { noSpinner: true });
    if (!sensors.sensors.length) {
        // no sensors
        return;
    }

    // add chart
    addChartContainer(elem, {
        title,
        type: "line",
        timeseries: true,
        legend: true,
        actions: [
            new RefreshAction()
        ],
        async data(containerData) {
            
            const data = await graphql(`
                {
                    dataUngroupedCountQuery(
                        filter: { sensorIds: ["${sensors.sensors.map(s => s.id).join('","')}"] }
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
            const datasets = data.dataUngroupedCountQuery.map(d => {
                return {
                    id: d.id,
                    name: d.name,
                    data: d.data as Array<DataElement>
                } as DataSet;
            })
            return datasets;
        },
    });
}
