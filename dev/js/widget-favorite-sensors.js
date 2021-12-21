const fetcher = require("./fetch-util");
const dateutils = require("./date-utils");
const uiutils = require("./ui-utils");

module.exports = (elem) => {
    const updateFavoriteSensors = () => {
        // clear element
        elem.html("");

        // load favorite sensors
        fetcher.graphql(`{favoriteSensors{id,name,icon,scaleFactor,last_reading{value,dt},icon,device{id, house{id}}}}`, {"noSpinner": true}).then(data => {
            const sensors = data.favoriteSensors;
            if (!sensors.length) return;

            // add title
            uiutils.appendTitleRow(
                elem,
                "Favorite Sensors", [],
                "h5"
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
        })
    }
    updateFavoriteSensors();
}