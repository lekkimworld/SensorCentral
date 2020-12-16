const uiutils = require("./ui-utils");
const $ = require("jquery");
const fetcher = require("./fetch-util");
const formsutil = require("./forms-util");
const dateutils = require("./date-utils");

module.exports = (document, elemRoot, ctx) => {
    const houseId = ctx.houseId;

    const createDevice = (data) => {
        fetcher.graphql(`mutation {createDevice(data: {houseId: "${houseId}", id: "${data.id}", name: "${data.name}", active: ${data.active}}){id}}`).then(body => {
            document.location.reload();
        })
    }
    const editDevice = (data) => {
        console.log(data);
        fetcher.graphql(`mutation {updateDevice(data: {id: "${data.id}", name: "${data.name}", active: ${data.active}}){id}}`).then(body => {
            document.location.reload();
        })
    }

    const updateUI = () => {
        elemRoot.html("");

        fetcher.graphql(`{house(id:"${houseId}"){id,name}devices(houseId:"${houseId}"){id,name,watchdog{notify},last_ping,last_restart,last_watchdog_reset,active,house{id,name}}}`).then(data => {
            const devices = data.devices.sort((a, b) => a.name.localeCompare(b.name));
            const houseName = data.house.name;

            elemRoot.html(uiutils.htmlBreadcrumbs([
                { "text": "Home", "id": "#root" },
                { "text": "Houses", "id": "houses" }
            ]));
            uiutils.appendTitleRow(
                elemRoot,
                houseName, [{
                        "rel": "create",
                        "icon": "plus",
                        "click": () => {
                            formsutil.appendDeviceCreateEditForm(undefined, createDevice);
                        }
                    },
                    {
                        "rel": "refresh",
                        "icon": "refresh",
                        "click": () => {
                            updateUI();
                        }
                    }
                ]
            );
            uiutils.appendSectionTitle(elemRoot, "Active Devices");
            uiutils.appendDataTable(elemRoot, {
                "actions": [{
                        "icon": "pencil",
                        "rel": "edit",
                        "click": function(ctx) {
                            formsutil.appendDeviceCreateEditForm(ctx.data, editDevice);
                        }
                    },
                    {
                        "icon": "trash",
                        "rel": "trash",
                        "click": function(ctx) {
                            formsutil.appendTrashForm({
                                "id": ctx.data.id,
                                "name": ctx.data.name,
                                "form": {
                                    "title": "Delete Device",
                                    "message": "Are you absolutely sure you want to DELETE this device? This will also DELETE all sensors for this device. Sensor samples are not deleted from the database."
                                }
                            }, (ctx) => {
                                fetcher.graphql(`mutation {deleteDevice(data: {id: "${ctx.id}"})}`).then(body => {
                                    document.location.reload();
                                })
                            })
                        }
                    },
                    {
                        "icon": "key",
                        "rel": "jwt",
                        "click": function(ctx) {
                            formsutil.appendJWTForm(ctx.data);
                        }
                    }
                ],
                "headers": ["NAME", "WATCHDOG", "STATUS", "ID"],
                "classes": [
                    "",
                    "text-center",
                    "",
                    "d-none d-sm-table-cell"
                ],
                "rows": devices.filter(d => d.active).map(device => {
                    const notify = (function(n) {
                        let notify;

                        if ("yes" === n) {
                            notify = `<i class="fa fa-volume-up sensorcentral-size-2x"></i>`;
                        } else if ("muted" === n) {
                            notify = `<i class="fa fa-volume-down sensorcentral-size-2x"></i>`;
                        } else {
                            notify = `<i class="fa fa-volume-off sensorcentral-size-2x"></i>`
                        }
                        return notify;
                    })(device.watchdog.notify);

                    const diff_options = {
                        "maxDiff": 12,
                        "scale": "minutes",
                        "defaultVale": "N/A"
                    }
                    const status = `Last ping: ${dateutils.timeDifferenceAsString(device.last_ping, diff_options)}<br/>Last restart: ${dateutils.timeDifferenceAsString(device.last_restart, diff_options)}<br/>Last reset: ${dateutils.timeDifferenceAsString(device.last_watchdog_reset, diff_options)}`;

                    return {
                        "id": device.id,
                        "data": device,
                        "columns": [device.name, notify, status, device.id],
                        "click": function() {
                            document.location.hash = `configuration/house/${device.house.id}/device/${this.id}`
                        }
                    }
                })
            });

            uiutils.appendSectionTitle(elemRoot, "Inactive Devices");
            uiutils.appendDataTable(elemRoot, {
                "actions": [{
                    "icon": "pencil",
                    "rel": "edit",
                    "click": function(ctx) {
                        formsutil.appendDeviceCreateEditForm(ctx.data, editDevice);
                    }
                }],
                "headers": ["NAME", "ID"],
                "classes": [
                    "",
                    "",
                ],
                "rows": devices.filter(d => !d.active).map(device => {
                    return {
                        "id": device.id,
                        "data": device,
                        "columns": [device.name, device.id],
                        "click": function() {
                            document.location.hash = `configuration/house/${device.house.id}/device/${this.id}`
                        }
                    }
                })
            });
        })
    }

    const updateDeviceNotification = (deviceId, notify) => {
        fetcher.graphql(`mutation{updateDeviceWatchdog(data:{id:"${deviceId}",notify:"${notify}"}){id,name}}`).then(() => {
            updateUI();
        })
    }

    // build initial ui
    updateUI();

}