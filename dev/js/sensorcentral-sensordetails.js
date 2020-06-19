const uiutils = require("./ui-utils");
const $ = require("jquery");
const fetcher = require("./fetch-util");
const formutils = require("./forms-util");

module.exports = (document, elemRoot, ctx) => {
    // fetch sensor
    fetcher.graphql(`{sensor(id:"${ctx.sensorId}"){id, type, name, favorite, device{id,name,house{id,name}}}}`).then(data => {
        const sensor = data.sensor;
        
        // create breadcrumbs
        elemRoot.html(uiutils.htmlBreadcrumbs([
            {"text": "Home", "id": "#root"},
            {"text": "Houses", "id": "houses"},
            {"text": sensor.device.house.name, "id": `house/${sensor.device.house.id}`},
            {"text": sensor.device.name, "id": `house/${sensor.device.house.id}/device/${sensor.device.id}`}
        ]));

        // build ui based on sensor type
        let module;
        if (sensor.type === "gauge") {
            module = require("./sensorcentral-sensordetails-gauge");
        } else if (sensor.type === "counter") {
            module = require("./sensorcentral-sensordetails-counter");
        } else if (sensor.type === "delta") {
            module = require("./sensorcentral-sensordetails-delta");
        } else {
            elemRoot.append(`Unknown sensor type: ${sensor.type}`);
            return;
        }
        const actions = [];
        if (!module.hasOwnProperty("actionManualSample") || (module.hasOwnProperty("actionManualSample") && module.actionManualSample === true)) {
            actions.push({"rel": "create", "icon": "plus", "click": (action) => {
                formutils.appendManualSampleForm(sensor, (data) => {
                    // get field values
                    let postbody = {
                        "id": sensor.id,
                        "value": data.value,
                        "deviceId": sensor.device.id,
                        "dt": data.date.toISOString()
                    }
                    fetcher.post(`/api/v1/data/samples`, postbody).then(body => {
                        // convert date to a javascript date and push in cache
                        body.dt = moment.utc(body.dt).toDate();
                        
                        // update ui
                        module.updateUI(sensor, body);
                        
                    }).catch(err => {
                        
                    })
                })
            }})
        }
        actions.push({"rel": "refresh", "icon": "refresh", "click": (action) => {
            elemModule.html("");
            module.buildUI(elemModule, sensor);
        }})
        actions.push({"rel": "favorite", "icon": `${sensor.favorite ? "star" : "star-o"}`, "click": (action) => {
            const btn = $("button[rel=\"favorite\"");
            if (btn.hasClass("fa-star")) {
                btn.removeClass("fa-star");
                btn.addClass("fa-star-o");
                fetcher.graphql(`mutation {removeFavoriteSensor(id: \"${sensor.id}\")}`)
            } else {
                btn.removeClass("fa-star-o");
                btn.addClass("fa-star");
                fetcher.graphql(`mutation {addFavoriteSensor(id: \"${sensor.id}\")}`)
            }
        }})

        // create title row
        uiutils.appendTitleRow(
            elemRoot, 
            sensor.name, 
            actions
        );

        // tell module to build ui
        elemRoot.append(`<div id="sensorui"></div>`);
        const elemModule = $("#sensorui");
        module.buildUI(elemModule, sensor);
    })
}
