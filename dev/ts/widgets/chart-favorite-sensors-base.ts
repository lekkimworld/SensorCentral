import {graphql} from "../fetch-util";
import { addChartContainer } from "../../js/charts-util";

export default (elem: JQuery<HTMLElement>, title: string, type: string) => {
    const update = () => {
        graphql(`{sensors(data: {favorite: yes, type: ${type}}){id,name,type}}`, {"noSpinner": true}).then(data => {
            if (!data.sensors.length) {
                return;
            }
            const chartCtx = addChartContainer(elem, { title, actions: ["DOWNLOAD"] });
            chartCtx.gaugeChart({
                "sensors": data.sensors
            })
        })
    }
    update();
}
