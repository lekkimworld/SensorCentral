import {graphql} from "../fetch-util";
import * as dateutils from "../../js/date-utils";
import * as uiutils from "../../js/ui-utils";

export default async (elem: JQuery<HTMLElement>) => {
    const updateFavoriteSensors = async () => {
        // clear element
        elem.html("");

        // load favorite sensors
        const data = await graphql(`{sensors(data: {favorite: yes}){id,name,icon,scaleFactor,last_reading{value,dt},icon,device{id, house{id}}}}`, {"noSpinner": true});
        const sensors = data.sensors;
        if (!sensors.length) return;

        // add title
        uiutils.appendTitleRow(
            elem,
            "Favorite Sensors", [],
            {tag: "h5"}
        );

        // build table
        uiutils.appendDataTable(elem, {
            "headers": ["NAME", "TYPE", "LAST READING"],
            "classes": [
                "",
                "text-center",
                ""
            ],
            "rows": sensors.map(sensor => {
                const type_img = `<i class="fa fa-${sensor.icon}" aria-hidden="true"></i>`;
                return {
                    "id": sensor.id,
                    "data": sensor,
                    "columns": [
                        sensor.name,
                        type_img,
                        sensor.last_reading ? `${sensor.last_reading.value} (${dateutils.formatDMYTime(sensor.last_reading.dt)})` : "None found"
                    ],
                    "click": function() {
                        document.location.hash = `configuration/house/${sensor.device.house.id}/device/${sensor.device.id}/sensor/${sensor.id}`
                    }
                }
            })
        });
    }
    updateFavoriteSensors();
}
