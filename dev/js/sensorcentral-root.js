const storage = require("./storage-utils");
const uiutils = require("./ui-utils");
const log = require("./logger");
const fetcher = require("./fetch-util");
const dateutils = require("./date-utils");
const {barChart, ID_CHART} = require("./charts-util");
const moment = require("moment");
const { Console } = require("console");

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

    const updateFavoriteSensors = () => {
        const elemRoot = $("#sensorcentral_favorites");
        elemRoot.html("");

        // load favorite sensors
        fetcher.graphql(`{favoriteSensors{id,name,icon,last_reading{value,dt},icon,device{id, house{id}}}}`).then(data => {
            const sensors = data.favoriteSensors;
            if (!sensors.length) return;

            // add title
            uiutils.appendTitleRow(
                elemRoot,
                "Favorite Sensors", 
                [
                    {"rel": "refresh", "icon": "refresh", "click": () => {
                        updateFavoriteSensors();
                    }}
                ],
                "h5"
            );
            
            // build table
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

    const buildUI = () => {
        // user is authenticated
        const user = storage.getUser();
        elemRoot.html(`<h1>Hello ${user.fn}!</h1>`);

        // add graph with power data
        elemRoot.append(`
            <div class="row">
                <div class="col-lg-6 col-md-12 col-sm-12">
                    ${uiutils.htmlSectionTitle("Graph")}
                    <canvas id="${ID_CHART}"></canvas>
                </div>
                <div id="sensorcentral_favorites" class="col-lg-6 col-md-12 col-sm-12"></div>
            </div>
        `);

        // load power data
        fetcher.graphql(`query {
            powerQuery2(data: {daysBack: 2, daysForward: 1}){...dataFields}
          }
          fragment dataFields on Dataset {id,name,data{x,y}}`).then(result => {
            
            barChart(
                ID_CHART,
                result.powerQuery2[0].data.map(v => v.x),
                {
                    "datasets": result.powerQuery2.map(r => {
                        return {
                            "label": r.name,
                            "data": r.data.map(v => v.y)    
                        }
                    })
                }
            )
        })

        // get favorite sensors and build ui
        updateFavoriteSensors();
    }
    
    // build UI
    buildUI();    
}
