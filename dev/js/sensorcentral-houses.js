const uiutils = require("./ui-utils");
const formsutil = require("./forms-util");
const $ = require("jquery");
const fetcher = require("./fetch-util");

const saveHouse = (data) => {
    let p;
    if (data.id && data.id.length) {
        // edit
        p = fetcher.graphql(`mutation {updateHouse(data: {id: "${data.id}", name: "${data.name}"}){id}}`);
    } else {
        // create
        p = fetcher.graphql(`mutation {createHouse(data: {name: "${data.name}"}){id}}`);
    }
    p.then(body => {
        document.location.reload();
    })
}

module.exports = (document, elemRoot, ctx) => {
    const updateUI = () => {
        elemRoot.html("");

        // load houses
        fetcher.graphql(`{houses{id,name,favorite}}`).then(data => {
            // sort
            const houses = data.houses.sort((a, b) => a.name.localeCompare(b.name));

            // do title row
            uiutils.appendTitleRow(
                elemRoot,
                "Houses", [{
                        "rel": "create",
                        "icon": "plus",
                        "click": function() {
                            formsutil.appendHouseCreateEditForm(undefined, saveHouse);
                        }
                    },
                    {
                        "rel": "refresh",
                        "icon": "refresh",
                        "click": function() {
                            updateUI(elemRoot, ctx);
                        }
                    }
                ]
            );
            uiutils.appendDataTable(elemRoot, {
                "actions": [{
                        "icon": "pencil",
                        "rel": "edit",
                        "click": function(ctx) {
                            formsutil.appendHouseCreateEditForm(ctx.data, saveHouse);
                        }
                    },
                    {
                        "icon": "trash",
                        "rel": "trash",
                        "click": function(ctx) {
                            const formContext = {
                                "id": ctx.data.id,
                                "name": ctx.data.name,
                                "form": {
                                    "title": "Delete House?",
                                    "message": "Are you absolutely sure you want to DELETE this house? This will also DELETE all devices and sensors for this house. Sensor samples are not removed from the database."
                                }
                            }
                            formsutil.appendTrashForm(formContext, (ctx) => {
                                fetcher.graphql(`mutation {deleteHouse(data: {id: "${ctx.id}"})}`).then(body => {
                                    document.location.reload();
                                })
                            })
                        }
                    },
                    {
                        "icon": "lock",
                        "rel": "lock",
                        "click": function(ctx) {
                            formsutil.appendHouseAccessForm(ctx.data, (data) => {
                                console.log(data);
                            })
                        }
                    },
                    {
                        "rel": "favorite",
                        "icon": (data) => data.favorite ? "star" : "star-o",
                        "click": (ctx) => {
                            fetcher.graphql(`mutation {favoriteHouse(data: {id: "${ctx.id}"}){id}}`).then(body => {
                                document.location.reload();
                            })
                        }
                    }
                ],
                "headers": ["NAME", "ID"],
                "classes": [
                    "",
                    "d-none d-sm-table-cell"
                ],
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

    // build initial ui
    updateUI();
}