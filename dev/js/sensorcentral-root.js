const storage = require("./storage-utils");
const uiutils = require("./ui-utils");
const log = require("./logger");
const fetcher = require("./fetch-util");

module.exports = (document, elemRoot) => {
    if (storage.isLoggedIn()) {
        // user is authenticated
        const user = storage.getUser();
        elemRoot.html(`<h1>Hello ${user.fn}!</h1>`);
        
        uiutils.appendSectionTitle(elemRoot, "Favorite Sensors");
        fetcher.graphql(`{favoriteSensors{id,name,last_reading,type,device{id, house{id}}}}`).then(data => {
            const sensors = data.favoriteSensors;
            uiutils.appendDataTable(elemRoot, {
                "headers": ["NAME", "TYPE", "LAST READING"],
                "classes": [
                    "", 
                    "",
                    ""
                ],
                "rows": sensors.map(sensor => {
                    const type_img = `<i class="fa fa-${sensor.type === "temp" ? "thermometer-empty" : "tint"} aria-hidden="true"></i>`;
                    return {
                        "id": sensor.id,
                        "data": sensor,
                        "columns": [sensor.name, type_img, sensor.last_reading || "None found"],
                        "click": function() {
                            document.location.hash = `configuration/house/${sensor.device.houseid}/device/${sensor.device.id}/sensor/${sensor.id}`
                        }
                    }
                })
            });
        })
    } else {
        // user is NOT authenticated
        elemRoot.html(`<h1>Hello stranger!</h1>
        <p>
            Please <a href="javascript:void(0)" id="login">login</a> to use the application.
        </p>`);
        $("#login").on("click", () => {
            storage.login();
            document.location.reload();
        })
    }    
}
