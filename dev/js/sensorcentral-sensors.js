const uiutils = require("./ui-utils");
const $ = require("jquery");
const fetcher = require("./fetch-util");

module.exports = (document, elemRoot, ctx) => {
    fetcher.get(`/api/v1/devices/${ctx.deviceId}/sensors`).then(sensors => {
        elemRoot.html(uiutils.htmlBreadcrumbs([
            {"text": "Houses", "id": "houses"},
            {"text": sensors[0].device.house.name, "id": `house/${sensors[0].device.house.id}`},
            {"text": sensors[0].device.name}
        ]));
        elemRoot.append(
            uiutils.htmlTitleRow(
                "Sensors", 
                [
                    {"rel": "create", "icon": "plus"},
                    {"rel": "edit", "icon": "minus"}
                ]
            ));
        uiutils.appendDataTable(elemRoot, {
            "actions": [
                {"icon": "pencil", "rel": "edit", "click": function(ctx) {
                    console.log(ctx, this);
                }},
                {"icon": "trash", "rel": "trash", "click": function(ctx) {
                    console.log(ctx, this);
                }}
            ],
            "headers": ["NAME", "LABEL", "ID"],
            "rows": sensors.map(sensor => {
                return {
                    "id": sensor.id,
                    "data": sensor,
                    "columns": [sensor.name, sensor.label, sensor.id],
                    "click": function() {
                        document.location.hash = `configuration/house/${ctx.houseId}/device/${ctx.deviceId}/sensor/${sensor.id}`
                    }
                }
            })
        });
    })
}
