const uiutils = require("./ui-utils");
const $ = require("jquery");
const fetcher = require("./fetch-util");
const formsutil = require("./forms-util");

module.exports = (document, elemRoot, ctx) => {
    const houseId = ctx.houseId;

    const createDevice = (data) => {
        fetcher.graphql(`mutation {createDevice(data: {houseId: "${houseId}", id: "${data.id}", name: "${data.name}"}){id}}`).then(body => {
            document.location.reload();
        })
    }
    const editDevice = (data) => {
        fetcher.graphql(`mutation {updateDevice(data: {id: "${data.id}", name: "${data.name}"}){id}}`).then(body => {
            document.location.reload();
        })
    }

    const updateUI = () => {
        elemRoot.html("");
    
        fetcher.graphql(`{house(id:"${houseId}"){id,name}devices(houseId:"${houseId}"){id,name,house{id,name}}}`).then(data => {
            const devices = data.devices.sort((a,b) => a.name.localeCompare(b.name));
            const houseName = data.house.name;
    
            elemRoot.html(uiutils.htmlBreadcrumbs([
                {"text": "Houses", "id": "houses"},
                {"text": houseName}
            ]));
            uiutils.appendTitleRow(
                elemRoot,
                "Devices", 
                [
                    {"rel": "create", "icon": "plus", "click": () => {
                        formsutil.appendDeviceCreateEditForm(undefined, createDevice);
                    }},
                    {"rel": "refresh", "icon": "refresh", "click": () => {
                        updateUI();
                    }}
                ]
            );
            uiutils.appendDataTable(elemRoot, {
                "actions": [
                    {"icon": "pencil", "rel": "edit", "click": function(ctx) {
                        formsutil.appendDeviceCreateEditForm(ctx.data, editDevice);
                    }},
                    {"icon": "trash", "rel": "trash", "click": function(ctx) {
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
                    }},
                    {"icon": "key", "rel": "jwt", "click": function(ctx) {
                        formsutil.appendJWTForm(ctx.data);
                    }},
                    {"rel": "notify_on", "click": function(ctx) {
                        updateDeviceNotification(ctx.id, "yes");
                    }},
                    {"rel": "notify_off", "click": function(ctx) {
                        updateDeviceNotification(ctx.id, "no");
                    }},
                    {"rel": "notify_mute", "click": function(ctx) {
                        updateDeviceNotification(ctx.id, "muted");
                    }}
                ],
                "headers": ["NAME", "NOTIFY", "MUTED UNTIL", "LAST PING", "ID"],
                "classes": [
                    "", 
                    "d-none d-md-table-cell",
                    "d-none d-md-table-cell",
                    "",
                    "d-none d-sm-table-cell"
                ],
                "rows": devices.map(device => {
                    const notify = (function(n) {
                        if ("yes" === n) {
                            return `<i class="btn fa fa-volume-up sensorcentral-size-2x" rel="notify_mute" aria-hidden="true"></i>`;
                        } else if ("muted" === n) {
                            return `<i class="btn fa fa-volume-down sensorcentral-size-2x" rel="notify_off" aria-hidden="true"></i>`;
                        } else {
                            return `<i class="btn fa fa-volume-off sensorcentral-size-2x" rel="notify_on" aria-hidden="true"></i>`
                        }
                    })(device.notify);
                    const mutedUntil = device.str_mutedUntil;
                    const lastping = device.hasOwnProperty("lastping") && typeof device.lastping === "number" ? `${device.lastping} mins.` : "";
                    return {
                        "id": device.id,
                        "data": device,
                        "columns": [device.name, notify, mutedUntil, lastping, device.id],
                        "click": function() {
                            document.location.hash = `configuration/house/${device.house.id}/device/${this.id}`
                        }
                    }
                })
            });
        })
    }
    
    const updateDeviceNotification = (deviceId, notify) => {
        fetcher.graphql(`mutation{updateDevice(data:{deviceId:"${deviceId}",notify:"${notify}"}){id,name,str_mutedUntil,notify}}`).then(() => {
            updateUI();
        })
    }

    // build initial ui
    updateUI();
    
}
