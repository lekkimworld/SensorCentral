const uiutils = require("./ui-utils");
const $ = require("jquery");
const fetcher = require("./fetch-util");

module.exports = (document, elemRoot) => {
    fetcher.get(`/api/v1/devices`).then(devices => {
        elemRoot.html(
            uiutils.htmlTitleRow(
                "Devices", 
                {"rel": "create", "icon": "plus"},
                {"rel": "edit", "icon": "minus"}
            ));
        uiutils.appendDataTable(elemRoot, {
            "actions": [
                {"icon": "pencil", "rel": "edit", "click": function(ctx) {
                    console.log(ctx, this);
                }},
                {"icon": "trash", "rel": "trash", "click": function(ctx) {
                    console.log(ctx, this);
                }},
                {"icon": "key", "rel": "jwt", "click": function(ctx) {
                    console.log(ctx, this);
                }}
            ],
            "headers": ["NAME", "NOTIFY", "ID"],
            "rows": devices.map(device => {
                return {
                    "id": device.id,
                    "data": [device.name, "", device.id],
                    "click": function() {
                        document.location.hash = `houses/${device.house.id}/${this.id}`
                    }
                }
            })
        });
    })
}
