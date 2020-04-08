const uiutils = require("./ui-utils");
const $ = require("jquery");
const fetcher = require("./fetch-util");
const formsutil = require("./forms-util");

module.exports = (document, elemRoot, ctx) => {
    const houseId = ctx.houseId;

    const createDevice = (data) => {
        fetcher.post(`/api/v1/devices`, {
            "name": data.name,
            "id": data.id,
            "house": houseId
        }).then(body => {
            document.location.reload();
        })
    }
    const editDevice = (data) => {
        fetcher.put(`/api/v1/devices`, {
            "id": data.id,
            "name": data.name
        }).then(body => {
            document.location.reload();
        })
    }

    elemRoot.html("");

    fetcher.get(`/api/v1/devices`).then(devices => {
        elemRoot.html(uiutils.htmlBreadcrumbs([
            {"text": "Houses", "id": "houses"},
            {"text": devices[0].house.name}
        ]));
        uiutils.appendTitleRow(
            elemRoot,
            "Devices", 
            [
                {"rel": "create", "icon": "plus", "click": () => {
                    formsutil.appendDeviceCreateEditForm(undefined, createDevice);
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
                        fetcher.delete("/api/v1/devices", {
                            "id": ctx.id
                        }, "text").then(body => {
                            document.location.reload();
                        })
                    })
                }},
                {"icon": "key", "rel": "jwt", "click": function(ctx) {
                    formsutil.appendJWTForm(ctx.data);
                }}
            ],
            "headers": ["NAME", "NOTIFY", "MUTED UNTIL", "LAST PING", "ID"],
            "rows": devices.map(device => {
                console.log(device);
                return {
                    "id": device.id,
                    "data": device,
                    "columns": [device.name, "", device.mutedUntil, device.lastPing, device.id],
                    "click": function() {
                        document.location.hash = `configuration/house/${device.house.id}/device/${this.id}`
                    }
                }
            })
        });
    })
}
