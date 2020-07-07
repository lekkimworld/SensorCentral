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

    const updateUI = () => {
        // user is authenticated
        const user = storage.getUser();
        elemRoot.html(`<h1>Hello ${user.fn}!</h1>`);

        elemRoot.append(uiutils.htmlSectionTitle("Graph"));
        elemRoot.append(`<canvas id="${ID_CHART}" width="${window.innerWidth - 20}px" height="300px"></canvas>`);
        fetcher.graphql(`query {
            today: powerQuery(data: {dayAdjust: 0}){...dataFields}
            yesterday: powerQuery(data: {dayAdjust: -1}){...dataFields}
            tomorrow: powerQuery(data: {dayAdjust: 1}){...dataFields}
          }
          fragment dataFields on Dataset {id,name,data{x,y}}`).then(result => {
            
            barChart(
                ID_CHART,
                result.today.data.map(v => v.x),
                {
                    "datasets": [
                        {
                            "label": `Yesterday (${result.yesterday.name})`,
                            "data": result.yesterday.data.map(v => v.y)
                        },
                        {
                            "label": "Today",
                            "data": result.today.data.map(v => v.y)
                        },
                        {
                            "label": `Tomorrow (avail. @ 1PM, ${result.tomorrow.name})`,
                            "data": result.tomorrow.data.map(v => v.y)
                        }
                    ]
                }
            )
        })
       
        fetcher.graphql(`{favoriteSensors{id,name,icon,last_reading{value,dt},icon,device{id, house{id}}}}`).then(data => {
            const sensors = data.favoriteSensors;
            if (!sensors.length) return;

            // add title
            uiutils.appendTitleRow(
                elemRoot,
                "Favorite Sensors", 
                [
                    {"rel": "refresh", "icon": "refresh", "click": () => {
                        updateUI();
                    }}
                ]
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
    updateUI();    
}
