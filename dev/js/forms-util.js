const fetcher = require("./fetch-util");
const ID_ELEM_FORM = "sensorcentral-form";

const textField = (name, placeholder, fieldExplanation, required = false, validationText) => {
    return `<div class="form-group">
    <label for="${name}Input">${placeholder}</label>
    <input type="text" ${required ? "required" : ""} class="form-control" id="${name}Input" aria-describedby="${name}Help" placeholder="${placeholder}">
    <small id="${name}Help" class="form-text text-muted">${fieldExplanation || placeholder}</small>
    ${validationText ? `<div class="invalid-feedback">${validationText}</div>` : ""}
</div>`
}

const dropdown = (name, label, fieldExplanation, options, addBlank, required = false, validationText) => {
    let use_options = `${addBlank ? "<option></option>" : ""}
        ${Object.keys(options).map(key => `<option value="${key}">${options[key]}</option>`)}`;
    return `<div class="form-group">
        <label for="${name}Input">${label}</label>
        <select class="form-control" id="${name}Input" ${required ? "required": ""}>
            ${use_options}
        </select>
        <small id="${name}Help" class="form-text text-muted">${fieldExplanation}</small>
        ${required ? `<div class="invalid-feedback">
        ${validationText}
    </div>` : ""}
    </div>`
}


const DEVICE_JWT = {
    "name": "jwt", 
    "html": `<div class="modal fade" id="jwtModal" tabindex="-1" role="dialog" aria-labelledby="jwtModalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="jwtModalLabel">Device JWT</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <form id="jwtForm">
                    <div class="form-group">
                        <label for="jwtInput">JWT</label>
                        <input type="text"  class="form-control" id="jwtInput" aria-describedby="jwtHelp">
                        <small id="jwtHelp" class="form-text text-muted">JSON Web Token for device.</small>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
            </div>
        </div>
    </div>
</div>`,
    "fnInit": (ctx) => {
        return fetcher.post("/api/v1/login/jwt", {
            "house": ctx.device.house.id,
            "device": ctx.device.id
        }).then(obj => {
            const jwtField = $("#jwtInput");
            jwtField.val(obj.token);
            $("#jwtInput").prop("disabled", true);
            return Promise.resolve();
        })
    }
}
const MANUAL_SENSOR_SAMPLE = {
    "name": "sample",
    "html": `<div class="modal fade" id="sampleModal" tabindex="-1" role="dialog" aria-labelledby="sampleModalLabel" aria-hidden="true">
<div class="modal-dialog" role="document">
    <div class="modal-content">
        <div class="modal-header">
            <h5 class="modal-title" id="sampleModalLabel">Create/Edit Sample</h5>
            <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">&times;</span>
            </button>
        </div>
        <div class="modal-body">
            <form id="sampleForm" novalidate>
                <div class="form-group">
                    <label for="idInput">Sensor ID</label>
                    <input type="text" required class="form-control" id="idInput" aria-describedby="nameHelp">
                </div>
                <div class="form-group">
                    <label for="dtInput">Date/time</label>
                    <div class='input-group date' id='datetimepicker1'>
                        <input type='text' class="form-control" />
                        <span class="input-group-addon">
                            <span class="fa fa-calendar"></span>
                        </span>
                    </div>
                    <small id="dtHelp" class="form-text text-muted">Specify the sample date/time.</small>
                    <div class="invalid-feedback">
                        You must specify the date/time for the sample.
                    </div>
                </div>
                <div class="form-group">
                    <label for="sampleInput">Sample</label>
                    <input type="number" step=".0001" required class="form-control" id="sampleInput" aria-describedby="sampleHelp" placeholder="Enter sample value">
                    <small id="sampleHelp" class="form-text text-muted">Specify the sample value (must be a number).</small>
                    <div class="invalid-feedback">
                        You must specify the sample value for the sensor. Must be a number.
                    </div>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
            <button type="button" class="btn btn-primary" id="performAction">Save changes</button>
        </div>
    </div>
</div>
</div>`,
    "fnInit": (ctx) => {
        // init date picker
        $('#datetimepicker1').datetimepicker({
            locale: 'da_dk',
            inline: true,
            sideBySide: true,
            icons: {
                time: "fa fa-clock-o",
                date: "fa fa-calendar",
                up: "fa fa-arrow-up",
                down: "fa fa-arrow-down",
                next: "fa fa-arrow-right",
                previous: "fa fa-arrow-left"
            }
        });
        
        // disable id-field
        $("#idInput").prop("disabled", true);
        $("#idInput").val(ctx.sensor.id);

        return Promise.resolve();
    },
    "fnGetData": () => {
        // build return data
        const data = {
            "date": $('#datetimepicker1').data("DateTimePicker").date(),
            "value": Number.parseFloat($("#sampleInput").val())
        }
        return data;
    }
}

const HOUSE_CREATE_EDIT = {
    "name": "createHouse",
    "html": `<div class="modal fade" id="createHouseModal" tabindex="-1" role="dialog" aria-labelledby="createHouseModalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="createHouseModalLabel">Create/Edit House</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <form id="createHouseForm" novalidate>
                    <input type="hidden" value="" id="idInput">
                    <div class="form-group">
                        <label for="nameInput">Name</label>
                        <input type="text" required class="form-control" id="nameInput" aria-describedby="nameHelp" placeholder="Enter house name">
                        <small id="nameHelp" class="form-text text-muted">Specify the name of the house (maximum 128 characters).</small>
                        <div class="invalid-feedback">
                            You must specify the name for the house. Must be unique.
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
                <button type="button" class="btn btn-primary" id="performAction">Save changes</button>
            </div>
        </div>
    </div>
</div>`,
    "fnInit": (ctx) => {
        if (ctx.house) {
            const nameField = $("#nameInput");
            const idField = $("#idInput");
            nameField.val(ctx.house.name);
            idField.val(ctx.house.id);
            idField.prop("disabled", true);
        }
        return Promise.resolve();
    },
    "fnGetData": () => {
        const nameField = $("#nameInput");
        const idField = $("#idInput");
        return {
            "id": idField.val(),
            "name": nameField.val()
        }
    }
}

const DEVICE_CREATE_EDIT = {
    "name": "device",
    "html": `<div class="modal fade" id="deviceModal" tabindex="-1" role="dialog" aria-labelledby="deviceModalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="deviceModalLabel">Create/Edit Device</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <form id="deviceForm" novalidate>
                    <div class="form-group">
                        <label for="idInput">ID</label>
                        <input type="text" required class="form-control" id="idInput" aria-describedby="nameHelp" placeholder="Enter device ID">
                        <small id="idHelp" class="form-text text-muted">Specify the ID of the device (maximum 36 characters).</small>
                        <div class="invalid-feedback">
                            You must specify the ID for the device. Must be unique.
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="nameInput">Name</label>
                        <input type="text" required class="form-control" id="nameInput" aria-describedby="nameHelp" placeholder="Enter device name">
                        <small id="nameHelp" class="form-text text-muted">Specify the name of the device (maximum 128 characters).</small>
                        <div class="invalid-feedback">
                            You must specify the name for the device. Must be unique.
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="activeInput">Active</label>
                        <label class="sensorcentral-switch">
                            <input type="checkbox" id="activeInput" value="1">
                            <span class="sensorcentral-slider sensorcentral-round"></span>
                        </label>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
                <button type="button" class="btn btn-primary" id="performAction">Save changes</button>
            </div>
        </div>
    </div>
</div>`,
    "fnInit": (ctx) => {
        const idField = $("#idInput");
        const nameField = $("#nameInput");
        const activeField = $("#activeInput");
        if (ctx.device) {
            idField.val(ctx.device.id);
            idField.prop("disabled", true);
            nameField.val(ctx.device.name);
            activeField.prop("checked", ctx.device.active ? "1" : "");
        } else {
            activeField.prop("checked", "1");
        }
        return Promise.resolve();
    },
    "fnGetData": () => {
        const idField = $("#idInput");
        const nameField = $("#nameInput");
        const activeField = $("#activeInput");
        return {
            "id": idField.val(),
            "name": nameField.val(),
            "active": activeField.prop("checked")
        }
    }
}

const SENSOR_CREATE_EDIT = {
    "name": "sensor",
    "html": `<div class="modal fade" id="sensorModal" tabindex="-1" role="dialog" aria-labelledby="sensorModalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="sensorModalLabel">Create/Edit Sensor</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <form id="sensorForm" novalidate>
                    ${textField("id", "ID", "Specify the ID of the sensor (maximum 36 characters).", true, "You must specify the ID for the sensor. Must be unique.")}
                    ${textField("name", "Name", "Specify the name of the sensor (maximum 128 characters).", true, "You must specify the name for the sensor. Must be unique.")}
                    ${textField("label", "Label", "Specify the label of the sensor (maximum 128 characters).", true, "You must specify the label for the sensor. Must be unique.")}
                    ${dropdown("type", "Type", "Specify the type of the sensor.", {
                        "gauge": "Gauge",
                        "counter": "Counter"
                    }, false, true, "You must specify the type of the sensor.")}
                    ${dropdown("icon", "Icon", "Specify the icon for the sensor.", {
                        "battery-4": "Power",
                        "thermometer-0": "Temperatur",
                        "tint": "Humidity"
                    }, false, true, "You must specify the icon for the sensor.")}
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
                <button type="button" class="btn btn-primary" id="performAction">Save changes</button>
            </div>
        </div>
    </div>
</div>`,
    "fnInit": (ctx) => {
        if (ctx.sensor) {
            const idField = $("#idInput");
            const nameField = $("#nameInput");
            const labelField = $("#labelInput");
            const typeField = $("#typeInput");
            const iconField = $("#iconInput");
            idField.val(ctx.sensor.id);
            idField.prop("disabled", true);
            nameField.val(ctx.sensor.name);
            labelField.val(ctx.sensor.label);
            typeField.val(ctx.sensor.type);
            iconField.val(ctx.sensor.icon);
        }
        return Promise.resolve();
    },
    "fnGetData": () => {
        const idField = $("#idInput");
        const nameField = $("#nameInput");
        const labelField = $("#labelInput");
        const typeField = $("#typeInput");
        const iconField = $("#iconInput");
        return {
            "id": idField.val(),
            "name": nameField.val(),
            "label": labelField.val(),
            "type": typeField.val(),
            "icon": iconField.val()
        }
    }
}

const DELETE_ENTITY = {
    "name": "trash",
    "html": (ctx) => {
        return `<div class="modal fade" id="trashModal" tabindex="-1" role="dialog" aria-labelledby="trashModalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="trashModalLabel">${ctx.title}</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                ${ctx.message}
                <div class="form-group">
                    <label for="idInput">ID</label>
                    <input type="text" required class="form-control" id="idInput" disabled="1">
                </div>
                <div class="form-group">
                    <label for="nameInput">Name</label>
                    <input type="text" required class="form-control" id="nameInput" disabled="1">
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-danger" id="performAction">Yes</button>
                <button type="button" class="btn btn-secondary" data-dismiss="modal">No</button>
            </div>
        </div>
    </div>
</div>`
    },
    "fnInit": (ctx) => {
        const idField = $("#idInput");
        const nameField = $("#nameInput");
        nameField.val(ctx.name);
        idField.val(ctx.id);
        return Promise.resolve();
    },
    "fnGetData": () => {
        const idField = $("#idInput");
        return {
            "id": idField.val()
        }
    }
}

const SETTINGS = {
    "name": "settings",
    "html": `<div class="modal fade" id="settingsModal" tabindex="-1" role="dialog" aria-labelledby="${this.name}ModalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="settingsModalLabel">Settings</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <form id="settingsForm" novalidate>
                    ${dropdown("notify", "Notify Using", "Specify the way you'd like to get notified.", {
                        "pushover": "Pushover",
                        "email": "Email"
                    }, true)}
                    ${textField("pushoverApptoken", "Pushover App Token", "Specify the Pushover App Token")}
                    ${textField("pushoverUserkey", "Pushover User Key", "Specify the Pushover App Token")}
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
                <button type="button" class="btn btn-primary" id="performAction">Save changes</button>
            </div>
        </div>
    </div>
</div>`,
    "fnInit": (ctx) => {
        const apptokenField = $("#pushoverApptokenInput");
        const userkeyField = $("#pushoverUserkeyInput");
        const notifyField = $("#notifyInput");
        apptokenField.val(ctx.pushover_apptoken);
        userkeyField.val(ctx.pushover_userkey);
        notifyField.val(ctx.notify_using);

        return Promise.resolve();
    },
    "fnGetData": () => {
        const apptokenField = $("#pushoverApptokenInput");
        const userkeyField = $("#pushoverUserkeyInput");
        const notifyField = $("#notifyInput");
        return {
            "notify_using": notifyField.val(),
            "pushover_apptoken": apptokenField.val(),
            "pushover_userkey": userkeyField.val(),
        }
    }
}

const prepareForm = (formdata, ctx, onPerformAction) => {
    const elem = $(`#${ID_ELEM_FORM}`);
    if (typeof formdata.html === "function") {
        elem.html(formdata.html(ctx.form));
    } else {
        elem.html(formdata.html);
    }

    new Promise((resolve, reject) => {
        if (formdata.fnInit) {
            formdata.fnInit(ctx).then(resolve);
        } else {
            resolve();
        }
    }).then(() => {
        // show dialog
        $(`#${formdata.name}Modal`).modal("show");

        // add save handler
        $("#performAction").on("click", () => {
            // validate form
            const form = document.querySelector(`#${formdata.name}Form`);
            if (form && !form.checkValidity()) {
                form.classList.add('was-validated');
                return;
            }

            // get data
            const data = formdata.hasOwnProperty("fnGetData") ? formdata.fnGetData() : {};

            // remove form
            if (form) form.classList.remove('was-validated');
            $(`#${formdata.id}`).modal("hide"); 
            $('.modal-backdrop').remove();
            $('body').removeClass('modal-open');
            elem.html("");

            // callback
            if (onPerformAction) onPerformAction(data);
        });
    })
}



module.exports = {
    appendManualSampleForm: (sensor, onPerformAction) => {
        prepareForm(MANUAL_SENSOR_SAMPLE, {"sensor": sensor}, onPerformAction);
    },
    appendJWTForm: (device) => {
        prepareForm(DEVICE_JWT, {"device": device});
    },
    appendHouseCreateEditForm: (house, onPerformAction) => {
        prepareForm(HOUSE_CREATE_EDIT, {"house": house}, onPerformAction);
    },
    appendDeviceCreateEditForm: (device, onPerformAction) => {
        prepareForm(DEVICE_CREATE_EDIT, {"device": device}, onPerformAction);
    },
    appendSensorCreateEditForm: (sensor, onPerformAction) => {
        prepareForm(SENSOR_CREATE_EDIT, {"sensor": sensor}, onPerformAction);
    },
    appendTrashForm: (ctx, onPerformAction) => {
        prepareForm(DELETE_ENTITY, ctx, onPerformAction);
    },
    appendSettings: (ctx, onPerformAction) => {
        prepareForm(SETTINGS, ctx, onPerformAction);
    }
}
