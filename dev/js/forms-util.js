const fetcher = require("./fetch-util");
const ID_ELEM_FORM = "sensorcentral-form";

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
        return fetcher.post("/api/v1/jwt", {
            "house": ctx.device.house.id,
            "device": ctx.device.id
        }, "text").then(txt => {
            const jwtField = $("#jwtInput");
            jwtField.val(txt);
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
        if (ctx.device) {
            idField.val(ctx.device.id);
            idField.prop("disabled", true);
            nameField.val(ctx.device.name);
        }
        return Promise.resolve();
    },
    "fnGetData": () => {
        const idField = $("#idInput");
        const nameField = $("#nameInput");
        return {
            "id": idField.val(),
            "name": nameField.val()
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
                    <div class="form-group">
                        <label for="idInput">ID</label>
                        <input type="text" required class="form-control" id="idInput" aria-describedby="nameHelp" placeholder="Enter sensor ID">
                        <small id="idHelp" class="form-text text-muted">Specify the ID of the sensor (maximum 36 characters).</small>
                        <div class="invalid-feedback">
                            You must specify the ID for the sensor. Must be unique.
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="nameInput">Name</label>
                        <input type="text" required class="form-control" id="nameInput" aria-describedby="nameHelp" placeholder="Enter sensor name">
                        <small id="nameHelp" class="form-text text-muted">Specify the name of the sensor (maximum 128 characters).</small>
                        <div class="invalid-feedback">
                            You must specify the name for the sensor. Must be unique.
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="labelInput">Label</label>
                        <input type="text" required class="form-control" id="labelInput" aria-describedby="nameHelp" placeholder="Enter sensor label">
                        <small id="labelHelp" class="form-text text-muted">Specify the label of the sensor (maximum 128 characters).</small>
                        <div class="invalid-feedback">
                            You must specify the label for the sensor. Must be unique.
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="typeInput">Type</label>
                        <select class="form-control" id="typeInput" required>
                            <option></option>
                            <option value="temp">Temperature</option>
                            <option value="hum">Humidity</option>
                        </select>
                        <small id="typeHelp" class="form-text text-muted">Specify the type of the sensor.</small>
                        <div class="invalid-feedback">
                            You must specify the type of the sensor.
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
        if (ctx.sensor) {
            const idField = $("#idInput");
            const nameField = $("#nameInput");
            const labelField = $("#labelInput");
            const typeField = $("#typeInput");
            idField.val(ctx.sensor.id);
            idField.prop("disabled", true);
            nameField.val(ctx.sensor.name);
            labelField.val(ctx.sensor.label);
            typeField.val(ctx.sensor.type);
        }
        return Promise.resolve();
    },
    "fnGetData": () => {
        const idField = $("#idInput");
        const nameField = $("#nameInput");
        const labelField = $("#labelInput");
        const typeField = $("#typeInput");
        return {
            "id": idField.val(),
            "name": nameField.val(),
            "label": labelField.val(),
            "type": typeField.val()
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
    }
}
