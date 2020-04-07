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
    appendHouseCreadEditForm: (house, onPerformAction) => {
        prepareForm(HOUSE_CREATE_EDIT, {"house": house}, onPerformAction);
    },
    appendTrashForm: (ctx, onPerformAction) => {
        prepareForm(DELETE_ENTITY, ctx, onPerformAction);
    }
}
