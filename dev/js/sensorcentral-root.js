const storage = require("./storage-utils");
const uiutils = require("./ui-utils");
const log = require("./logger");
const fetcher = require("./fetch-util");
const dateutils = require("./date-utils");

module.exports = (document, elemRoot) => {
    if (!storage.isLoggedIn()) {
        // user is NOT authenticated
        elemRoot.html(`<h1>Hello stranger!</h1>
        <p>
            Please <a href="javascript:void(0)" id="login">login</a> to use the application.
        </p>`);
        $("#login").on("click", () => {
            storage.login();
            document.location.reload();
        });

        return;
    }

    const updateUI = () => {
        // user is authenticated
        const user = storage.getUser();
        elemRoot.html(`<h1>Hello ${user.fn}!</h1>`);

        uiutils.appendTitleRow(
            elemRoot,
            "Favorite Sensors", 
            [
                {"rel": "refresh", "icon": "refresh", "click": () => {
                    updateUI();
                }}
            ]
        );
        
        fetcher.graphql(`{favoriteSensors{id,name,icon,last_reading{value,dt},icon,device{id, house{id}}}}`).then(data => {
            const sensors = data.favoriteSensors;
            uiutils.appendDataTable(elemRoot, {
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
                            document.location.hash = `configuration/house/${sensor.device.houseid}/device/${sensor.device.id}/sensor/${sensor.id}`
                        }
                    }
                })
            });
        })
    }
    updateUI();    
}
