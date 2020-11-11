const storage = require("./storage-utils");
const uiutils = require("./ui-utils");
const log = require("./logger");
const fetcher = require("./fetch-util");
const dateutils = require("./date-utils");
const { barChart, ID_CHART } = require("./charts-util");
const moment = require("moment");

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
        fetcher.graphql(`{favoriteSensors{id,name,icon,scaleFactor,last_reading{value,dt},icon,device{id, house{id}}}}`).then(data => {
            const sensors = data.favoriteSensors;
            if (!sensors.length) return;

            // add title
            uiutils.appendTitleRow(
                elemRoot,
                "Favorite Sensors", [{
                    "rel": "refresh",
                    "icon": "refresh",
                    "click": () => {
                        updateFavoriteSensors();
                    }
                }],
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
        elemRoot.html(`
            <div class="row">
                <div class="col-lg-6 col-md-12 col-sm-12">
                    ${uiutils.htmlSectionTitle("Power Prices")}
                    <canvas id="${ID_CHART}"></canvas>
                </div>
                <div class="col-lg-6 col-md-12 col-sm-12">
                    ${uiutils.htmlSectionTitle("Stacked Delta Sensors (this week)")}
                    <canvas id="sensorcentral_power"></canvas>
                </div>
            </div>
            <div class="row">
                <div id="sensorcentral_favorites" class="mt-4 col-lg-12 col-md-12 col-sm-12"></div>
            </div>
        `);

        // load power data - build query 2 days back, today and tomorrow
        const m = moment().subtract(2, "days");
        let powerquery = "query {";
        for (let i = 0; i < 4; i++) {
            powerquery += `query${i}: powerQuery(data: {date: "${m.format("YYYY-MM-DD")}"}){id,name,fromCache,data{x,y}}\n`;
            m.add(1, "day");
        }
        powerquery += "}";
        fetcher.graphql(powerquery).then(result => {
            // build labels and datasets
            const labels = result["query0"].data.map(v => v.x);
            const datasets = Object.keys(result).reduce((prev, key) => {
                if (!result[key] || !result[key].data || !result[key].data.length) return prev;
                prev.push({
                    "label": result[key].name,
                    "data": result[key].data.map(v => v.y)
                })
                return prev;
            }, [])

            // do chart
            barChart(
                ID_CHART,
                labels, {
                    datasets
                }
            )
        })

        // load sensor data
        fetcher.graphql(`query {
            sensors(data: {type: delta}){id,name}
        }
        `).then(data => {
            return fetcher.graphql(`query {
                groupedQuery(data: {sensorIds: ["${data.sensors.map(s => s.id).join("\",\"")}"], groupBy: day, adjustBy: week, start: 0, end: -1, addMissingTimeSeries: true}){id, name, data{x,y}}
            }`).then(data => {
                const datasets = data.groupedQuery.map(q => {
                    return {
                        "label": q.name,
                        "data": q.data.map(d => d.y)
                    }
                })
                const labels = data.groupedQuery[0].data.map(d => d.x);

                barChart("sensorcentral_power", labels, {
                    "datasets": datasets,
                    "stacked": true
                })
            })
        })

        // get favorite sensors and build ui
        updateFavoriteSensors();
    }

    // build UI
    buildUI();
}