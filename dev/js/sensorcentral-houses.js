const uiutils = require("./ui-utils");
const formsutil = require("./forms-util");
const $ = require("jquery");
const fetcher = require("./fetch-util");

const saveHouse = (data) => {
    let p;
    if (data.id && data.id.length) {
        // edit
        p = fetcher.put(`/api/v1/houses`, {
            "id": data.id,
            "name": data.name
        })
    } else {
        // create
        p = fetcher.post(`/api/v1/houses`, {
            "name": data.name
        })
    }
    p.then(body => {
        document.location.reload();
    })
}

module.exports = (document, elemRoot) => {
    elemRoot.html("");
    fetcher.get(`/api/v1/houses`).then(houses => {
        uiutils.appendTitleRow(
            elemRoot, 
            "Houses", 
            [
                {"rel": "create", "icon": "plus", "click": function() {
                    formsutil.appendHouseCreateEditForm(undefined, saveHouse);
                }}
            ]
        );
        uiutils.appendDataTable(elemRoot, {
            "actions": [
                {"icon": "pencil", "rel": "edit", "click": function(ctx) {
                    formsutil.appendHouseCreateEditForm(ctx.data, saveHouse);
                }},
                {"icon": "trash", "rel": "trash", "click": function(ctx) {
                    const formContext = {
                        "id": ctx.data.id,
                        "name": ctx.data.name,
                        "form": {
                            "title": "Delete House?",
                            "message": "Are you absolutely sure you want to DELETE this house? This will also DELETE all devices and sensors for this house. Sensor samples are not removed from the database."
                        }
                    }
                    formsutil.appendTrashForm(formContext, (ctx) => {
                        fetcher.delete("/api/v1/houses", {
                            "id": ctx.id
                        }, "text").then(body => {
                            document.location.reload();
                        })
                    })
                }}
            ],
            "headers": ["NAME", "ID"],
            "rows": houses.map(house => {
                return {
                    "id": house.id,
                    "data": house,
                    "columns": [house.name, house.id],
                    "click": function() {
                        document.location.hash = `configuration/house/${this.id}`
                    }
                }
            })
        });
    })
}
