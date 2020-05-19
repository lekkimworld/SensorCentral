const uiutils = require("./ui-utils");
const $ = require("jquery");
const fetcher = require("./fetch-util");
const formsutil = require("./forms-util");

/*
Chart for all sensors on device together


window.addEventListener("DOMContentLoaded", () => {
        const formatDate = d => {
            const m = d.getMonth();
            const month = m===0 ? "jan" : m===1 ? "feb" : m === 2 ? "mar" : "apr";
            return `${d.getDate()} ${month}`;
        }
        const formatTime = d => {
            return `${d.getHours() < 10 ? "0" + d.getHours() : d.getHours()}:${d.getMinutes() < 10 ? "0" + d.getMinutes() : d.getMinutes()}`;
        }
        
        fetch(`/api/v1/devices/${deviceid}/sensors`).then(res => res.json()).then(sensors => {
            const colors = [
                "#122C34",
                "#4EA5D9",
                "#44CFCB",
                "#EF476F",
                "#FFD166",
                "#6B0F1A",
                "#9C7178",
                "#AAFAC8"
            ]
            return Promise.all(sensors.map((sensor, index) => {
                return fetch(`/api/v1/data/samples/${sensor.id}/800`).then(res => res.json()).then(samples => {
                    const arr = samples.reverse().map(sample => {
                        return {
                            "x": new Date(sample.dt),
                            "y": sample.value
                        }
                    })
                    const dataset = {
                        "label": sensor.name,
                        "data": arr,
                        "pointRadius": 0,
                        "fill": false,
                        "backgroundColor": 'rgba(0, 100, 255, 0.4)',
                        "borderColor": colors[index]
                    }
                    const labels = arr.map(d => `${formatDate(d.x)} ${formatTime(d.x)}`);
                    return Promise.resolve([sensor, dataset, labels]);
                })
            }))
        }).then(data => {
            // get datasets into array
            const datasets = data.map(d => d[1]);

            // labels will be the same
            const labels = data[0][2];

            // options
            const options = {
                "legend": {
                    "position": "top"
                },
                "responsive": false
            };

            // do chart
            window.SC.doChart({
                "labels": labels,
                "datasets": datasets
            }, "line", options);
        })
    })

*/

module.exports = (document, elemRoot, ctx) => {
    const houseId = ctx.houseId;
    const deviceId = ctx.deviceId;

    const createSensor = (data) => {
        fetcher.graphql(`mutation {createSensor(data: {deviceId: "${deviceId}", id: "${data.id}", name: "${data.name}", label: "${data.label}", type: "${data.type}", icon: "${data.icon}"}){id}}`).then(() => {
            document.location.reload();
        })
    }
    const editSensor = (data) => {
        fetcher.graphql(`mutation {updateSensor(data: {id: "${data.id}", name: "${data.name}", label: "${data.label}", type: "${data.type}", icon: "${data.icon}"}){id}}`).then(() => {
            document.location.reload();
        })
    }

    const updateUI = () => {
        elemRoot.html("");    
    
        // query for sensors and containing device
        fetcher.graphql(`{device(id:"${deviceId}"){id,name,house{id,name}}sensors(deviceId:"${deviceId}"){id,name,favorite,label,icon,type}}`).then(data => {
            const sensors = data.sensors.sort((a,b) => a.name.localeCompare(b.name));
            const device = data.device;
    
            elemRoot.html(uiutils.htmlBreadcrumbs([
                {"text": "Home", "id": "#root"},
                {"text": "Houses", "id": "houses"},
                {"text": device.house.name, "id": `house/${device.house.id}`}
            ]));
    
            uiutils.appendTitleRow(
                elemRoot,
                device.name, 
                [
                    {"rel": "create", "icon": "plus", "click": () => {
                        formsutil.appendSensorCreateEditForm(undefined, createSensor);
                    }},
                    {"rel": "refresh", "icon": "refresh", "click": () => {
                        updateUI(elemRoot, ctx);
                    }}
                ]
            );
            uiutils.appendDataTable(elemRoot, {
                "actions": [
                    {"icon": "pencil", "rel": "edit", "click": function(ctx) {
                        formsutil.appendSensorCreateEditForm(ctx.data, editSensor);
                    }},
                    {"icon": "trash", "rel": "trash", "click": function(ctx) {
                        formsutil.appendTrashForm({
                            "id": ctx.data.id,
                            "name": ctx.data.name,
                            "form": {
                                "title": "Delete Sensor",
                                "message": "Are you absolutely sure you want to DELETE this sensor? Sensor samples will not be deleted from the database."
                            }
                        }, (ctx) => {
                            fetcher.graphql(`mutation {deleteSensor(data: {id: "${ctx.id}"})}`).then(() => {
                                document.location.reload();
                            })
                        })
                    }},
                    {"rel": "favorite", "icon": (data) => data.favorite ? "star" : "star-o", "click": (ctx) => {
                        const btn = $(`tr[id="${ctx.id}"] button[rel="favorite"`);
                        if (btn.hasClass("fa-star")) {
                            btn.removeClass("fa-star");
                            btn.addClass("fa-star-o");
                            fetcher.graphql(`mutation {removeFavoriteSensor(id: \"${ctx.id}\")}`)
                        } else {
                            btn.removeClass("fa-star-o");
                            btn.addClass("fa-star");
                            fetcher.graphql(`mutation {addFavoriteSensor(id: \"${ctx.id}\")}`)
                        }
                    }}
                ],
                "headers": ["ICON", "NAME", "LABEL", "TYPE", "ID"],
                "classes": [
                    "text-center", 
                    "", 
                    "d-none d-md-table-cell",
                    "d-none d-md-table-cell",
                    "d-none d-sm-table-cell"
                ],
                "rows": sensors.map(sensor => {
                    const type_img = `<i class="fa fa-${sensor.icon}" aria-hidden="true"></i>`;
                    return {
                        "id": sensor.id,
                        "data": sensor,
                        "columns": [type_img, sensor.name, sensor.label, sensor.type, sensor.id],
                        "click": function() {
                            document.location.hash = `configuration/house/${ctx.houseId}/device/${ctx.deviceId}/sensor/${sensor.id}`
                        }
                    }
                })
            });
        })
    }

    // build initial ui
    updateUI();
}
