import {graphql} from "../fetch-util";
import {addChartContainer} from "../charting/charting";
import { DataElement, DataSet } from "../ui-helper";
import RefreshAction from "../charting/actions/refresh-action";

export default (elem: JQuery<HTMLElement>, title: string, type: string) => {
    addChartContainer(elem, {
        title,
        type: "line",
        timeseries: true,
        actions: [
            new RefreshAction()
        ],
        async data(containerData) {
            const sensors = await graphql(`{sensors(data: {favorite: yes, type: ${type}}){id,name,type}}`, {"noSpinner": true});
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
