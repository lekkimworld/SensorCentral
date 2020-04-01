const uiutils = require("./ui-utils");
const $ = require("jquery");

module.exports = (document, elemRoot) => {
    fetch(`/api/v1/houses`).then(resp => resp.json()).then(houses => {
        elemRoot.html(
            uiutils.htmlTitleRow(
                "Houses", 
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
                }}
            ],
            "headers": ["NAME", "ID"],
            "rows": houses.map(house => {
                return {
                    "id": house.id,
                    "data": [house.name, house.id],
                    "click": function() {
                        document.location.hash = `houses/${this.id}`
                    }
                }
            })
        });
    })
}
