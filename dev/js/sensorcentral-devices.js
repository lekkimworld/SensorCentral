const uiutils = require("./ui-utils");
const $ = require("jquery");
const fetcher = require("./fetch-util");
const formsutil = require("./forms-util");

module.exports = (document, elemRoot, ctx) => {
    fetcher.get(`/api/v1/devices`).then(devices => {
        elemRoot.html(uiutils.htmlBreadcrumbs([
            {"text": "Houses", "id": "houses"},
            {"text": devices[0].house.name}
        ]));
        uiutils.appendTitleRow(
            elemRoot,
            "Devices", 
            [
                {"rel": "create", "icon": "plus"}
            ]
        );
        uiutils.appendDataTable(elemRoot, {
            "actions": [
                {"icon": "pencil", "rel": "edit", "click": function(ctx) {
                    console.log(ctx, this);
                }},
                {"icon": "trash", "rel": "trash", "click": function(ctx) {
                    console.log(ctx, this);
                }},
                {"icon": "key", "rel": "jwt", "click": function(ctx) {
                    formsutil.appendJWTForm(ctx.data);
                }}
            ],
            "headers": ["NAME", "NOTIFY", "ID"],
            "rows": devices.map(device => {
                return {
                    "id": device.id,
                    "data": device,
                    "columns": [device.name, "", device.id],
                    "click": function() {
                        document.location.hash = `configuration/house/${device.house.id}/device/${this.id}`
                    }
                }
            })
        });
    })
}
