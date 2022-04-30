const { trim } = require("jquery");
const fetcher = require("./fetch-util");
const storage = require("./storage-utils");
const ID_ELEM_FORM = "sensorcentral-form";

const createDateTimePicker = id => {
    $(`#${id}`).datetimepicker({
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
}

const removeForm = () => {
    // remove form
    const elem = $(`#${ID_ELEM_FORM}`);
    $('.modal-backdrop').remove();
    $('body').removeClass('modal-open');
    elem.html("");
}

const appendError = (err, onPerformAction) => {
    removeForm();
    prepareForm(ERROR_FORM, {
        "form": {
            "error": err,
            "message": err.message
        }
    }, onPerformAction || logout)
}

const logout = () => {
    storage.logout();
    document.location.hash = "#loggedout";
}

const textField = (name, placeholder, fieldExplanation, required = false, validationText) => {
        return `<div class="form-group">
    <label for="${name}Input">${placeholder}</label>
    <input type="text" ${required ? "required" : ""} class="form-control" id="${name}Input" aria-describedby="${name}Help" placeholder="${placeholder}">
    <small id="${name}Help" class="form-text text-muted">${fieldExplanation || placeholder}</small>
    ${validationText ? `<div class="invalid-feedback">${validationText}</div>` : ""}
</div>`
}

const disabledTextField = (name, placeholder, fieldExplanation) => {
    return `<div class="form-group">
    <label for="${name}Input">${placeholder}</label>
    <input type="text" required class="form-control" id="${name}Input" disabled="1">
    ${
        fieldExplanation
            ? `<small id="${name}Help" class="form-text text-muted">${fieldExplanation}</small>`
            : ""
    }
</div>`;
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

const toggleButton = (name, label, fieldExplanation, on = true, value = "1") => {
    return `<div class="form-group">
        <label for="${name}Input">${label}</label><br/>
        <label class="sensorcentral-switch">
            <input type="checkbox" id="${name}Input" value="${value}" ${on ? "checked" : ""}>
            <span class="sensorcentral-slider sensorcentral-round"></span>
        </label>
<small id="${name}Help" class="form-text text-muted">${fieldExplanation}</small>
    </div>`
}

const buttonClose = (text = "Close") => {
    return `<button type="button" class="btn btn-secondary" data-dismiss="modal">${text}</button>`;
}

const buttonPerformAction = (text = "Save Changes", rel = "std") => {
    return `<button type="button" class="btn btn-primary" id="performAction" rel="${rel}">${text}</button>`;
}

const button = (text, rel, classList) => {
    return `<button type="button" class="btn ${classList ? classList.join(" ") : "btn-primary"}" rel="${rel}">${text}</button>`;
}

const datetimepicker = (name, label, fieldExplanation, required = false, validationText) => {
    return `<label for="${name}Input">${label}</label>
        <div class='input-group date' id='${name}'>
            <input type='text' class="form-control" />
            <span class="input-group-addon">
                <span class="fa fa-calendar"></span>
            </span>
        </div>
        <small id="${name}Help" class="form-text text-muted">${fieldExplanation}</small>
        ${required ? `<div class="invalid-feedback">
        ${validationText}
    </div>` : ""}`;
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
                ${buttonClose()}
            </div>
        </div>
    </div>
</div>`,
    "fnInit": (formdata, ctx) => {
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
const DATE_SELECT_FORM = {
    "name": "dateselect",
    "html": `<div class="modal fade" id="dateselectModal" tabindex="-1" role="dialog" aria-labelledby="dateselectModalLabel" aria-hidden="true">
<div class="modal-dialog" role="document">
    <div class="modal-content">
        <div class="modal-header">
            <h5 class="modal-title" id="dateselectModalLabel">Date Select</h5>
            <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">&times;</span>
            </button>
        </div>
        <div class="modal-body">
            <form id="dateselectForm" novalidate>
                <div class="form-group">
                    <label for="dtInput">Date</label>
                    <div class='input-group date' id='datetimepicker1'>
                        <input type='text' class="form-control" />
                        <span class="input-group-addon">
                            <span class="fa fa-calendar"></span>
                        </span>
                    </div>
                    <small id="dtHelp" class="form-text text-muted">Specify the date.</small>
                    <div class="invalid-feedback">
                        You must specify the date.
                    </div>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            ${buttonClose()}
            ${buttonPerformAction("Apply")}
        </div>
    </div>
</div>
</div>`,
    "fnInit": (formdata, ctx) => {
        // init date picker
        $('#datetimepicker1').datetimepicker({
            locale: 'da_dk',
            inline: true,
            sideBySide: true,
            format: 'LD',
            icons: {
                time: "fa fa-clock-o",
                date: "fa fa-calendar",
                up: "fa fa-arrow-up",
                down: "fa fa-arrow-down",
                next: "fa fa-arrow-right",
                previous: "fa fa-arrow-left"
            }
        });

        return Promise.resolve();
    },
    "fnGetData": () => {
        // build return data
        const data = {
            "date": $('#datetimepicker1').data("DateTimePicker").date()
        }
        return data;
    }
}
const INTERVAL_SELECT_FORM = {
    "name": "intervalselect",
    "html": (formname, ctx) => {
        return `<div class="modal fade" id="${formname}Modal" tabindex="-1" role="dialog" aria-labelledby="${formname}ModalLabel" aria-hidden="true">
<div class="modal-dialog" role="document">
    <div class="modal-content">
        <div class="modal-header">
            <h5 class="modal-title" id="${formname}ModalLabel">Interval Selection</h5>
            <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">&times;</span>
            </button>
        </div>
        <div class="modal-body">
            <form id="${formname}Form" novalidate>
                <div class="form-group">
                    <label for="dtInput">Start Date</label>
                    <div class='input-group date' id='start_dt'>
                        <input type='text' class="form-control" />
                        <span class="input-group-addon">
                            <span class="fa fa-calendar"></span>
                        </span>
                    </div>
                    <small id="dtHelp" class="form-text text-muted">Specify the start date/time.</small>
                    <div class="invalid-feedback">
                        You must specify the start date/time.
                    </div>
                </div>
                <div class="form-group">
                    <label for="dtInput">End Date</label>
                    <div class='input-group date' id='end_dt'>
                        <input type='text' class="form-control" />
                        <span class="input-group-addon">
                            <span class="fa fa-calendar"></span>
                        </span>
                    </div>
                    <small id="dtHelp" class="form-text text-muted">Specify the end date/time.</small>
                    <div class="invalid-feedback">
                        You must specify the end date/time.
                    </div>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            ${buttonClose()}
            ${buttonPerformAction("Apply")}
        </div>
    </div>
</div>
</div>`},
    "fnInit": (formdata, ctx) => {
        // init date/time pickers
        createDateTimePicker("start_dt");
        createDateTimePicker("end_dt");
        return Promise.resolve();
    },
    "fnGetData": () => {
        // build return data
        const sdt = $('#start_dt').data("DateTimePicker").date();
        const edt = $('#end_dt').data("DateTimePicker").date();
        const data = {
            "start_dt": edt.isAfter(sdt) ? sdt : edt,
            "end_dt": edt.isAfter(sdt) ? edt : sdt 
        }
        return data;
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
            ${buttonClose()}
            ${buttonPerformAction()}
        </div>
    </div>
</div>
</div>`,
    "fnInit": (formdata, ctx) => {
        // init date picker
        createDateTimePicker("datetimepicker1");
        
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
                    ${textField("name", "Enter house name", "Specify the name of the house (maximum 128 characters).", true, "You must specify the name for the house. Must be unique.")}
                </form>
            </div>
            <div class="modal-footer">
                ${buttonClose()}
                ${buttonPerformAction()}
            </div>
        </div>
    </div>
</div>`,
    "fnInit": (formdata, ctx) => {
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
                    ${textField("id", "Enter device ID", "Specify the ID of the device (maximum 36 characters).", true, "You must specify the ID for the device. Must be unique.")}
                    ${textField("name", "Enter device name", "Specify the name of the device (maximum 128 characters).", true, "You must specify the name for the device. Must be unique.")}
                    ${toggleButton("active", "Active", "Making a device inactive sorts it at the bottom and disables the watchdog for the device.")}
                </form>
            </div>
            <div class="modal-footer">
                ${buttonClose()}
                ${buttonPerformAction()}
            </div>
        </div>
    </div>
</div>`,
    "fnInit": (formdata, ctx) => {
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
                        "counter": "Counter",
                        "delta": "Delta"
                    }, false, true, "You must specify the type of the sensor.")}
                    ${dropdown("icon", "Icon", "Specify the icon for the sensor.", {
                        "battery-4": "Power",
                        "thermometer-empty": "Temperature",
                        "tint": "Humidity",
                        "tachometer": "Tachometer"
                    }, false, true, "You must specify the icon for the sensor.")}
                    ${dropdown("scalefactor", "Scale Factor", "Specify the scale factor for the sensor.", {
                        "1": "1",
                        "0.001": "1/1000",
                        "0.002": "1/500",
                        "0.01": "1/100"
                    }, false, true, "You must specify the scale factor for the sensor.")}
                </form>
            </div>
            <div class="modal-footer">
                ${buttonPerformAction("Yes")}
                ${buttonClose("No")}
            </div>
        </div>
    </div>
</div>`,
    "fnInit": (formdata, ctx) => {
        if (ctx.sensor) {
            const idField = $("#idInput");
            const nameField = $("#nameInput");
            const labelField = $("#labelInput");
            const typeField = $("#typeInput");
            const iconField = $("#iconInput");
            const scaleField = $("#scalefactorInput");
            idField.val(ctx.sensor.id);
            idField.prop("disabled", true);
            nameField.val(ctx.sensor.name);
            labelField.val(ctx.sensor.label);
            typeField.val(ctx.sensor.type);
            iconField.val(ctx.sensor.icon);
            scaleField.val(ctx.sensor.scaleFactor);
        }
        return Promise.resolve();
    },
    "fnGetData": () => {
        const idField = $("#idInput");
        const nameField = $("#nameInput");
        const labelField = $("#labelInput");
        const typeField = $("#typeInput");
        const iconField = $("#iconInput");
        const scaleField = $("#scalefactorInput");
        return {
            "id": idField.val(),
            "name": nameField.val(),
            "label": labelField.val(),
            "type": typeField.val(),
            "icon": iconField.val(),
            "scaleFactor": scaleField.val()
        }
    }
}

const DELETE_ENTITY = {
    "name": "trash",
    "html": (formname, ctx) => {
        return `<div class="modal fade" id="${formname}Modal" tabindex="-1" role="dialog" aria-labelledby="${formname}ModalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="${formname}ModalLabel">${ctx.title}</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                ${ctx.message}
                ${disabledTextField("id", "ID")}
                ${disabledTextField("name", "Name")}
            </div>
            <div class="modal-footer">
                ${buttonPerformAction("Yes")}
                ${buttonClose("No")}
            </div>
        </div>
    </div>
</div>`
    },
    "fnInit": (formdata, ctx) => {
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

const DEVICE_EDIT_WATCHDOG = {
    "name": "watchdog",
    "html": (formname, ctx) => {
        return {
            "html": `<div class="modal fade" id="${formname}Modal" tabindex="-1" role="dialog" aria-labelledby="${formname}ModalLabel" aria-hidden="true">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="${formname}ModalLabel">Watchdog</h5>
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="modal-body">
                    <p>
                    This dialog allows you to change the watchdog settings for the selected 
                    device. You may indicate whether notifications about the device is on (i.e. sent), 
                    off (i.e. NOT sent) or muted. If muted you have to specify a date/time the notifications 
                    are muted until. After that date/time notifications are sent as if the watchdog was set to 
                    "on".
                    </p>
                    <p>
                    Remember that watchdogs are personal and these settings only applies to you.
                    </p>
                    ${dropdown("state", "State", "Select the state to set for the device watchdog", {
                        "yes": "On",
                        "no": "Off",
                        "muted": "Muted"
                    }, false, true, "You must specify a watchdog state")}
                    ${datetimepicker("dt", "Muted until", "Specify the muted until date/time")}
                </div>
                <div class="modal-footer">
                    ${button("Save", "save")}
                    ${buttonClose("Cancel")}
                </div>
            </div>
        </div>
    </div>`,
        "callback": () => {
            createDateTimePicker("dt");
        }};
    },
    device: undefined,
    "fnInit": (formdata, device) => {
        formdata.device = device;
        return fetcher.graphql(`{device(id:"${device.id}"){id,name,watchdog{notify,muted_until}}}`).then(data => {
            const wd = data.device.watchdog;
            if (wd.muted_until) {
                $("#dt").data("DateTimePicker").date(moment(wd.muted_until).set("seconds", 0).set("milliseconds", 0));
            } else {
                $("#dt").data("DateTimePicker").date(moment().set("minutes", 0).set("seconds", 0).set("milliseconds", 0).add(1, "hour"));
            }
            $("#stateInput").val(wd.notify);
            return Promise.resolve();
        })
        
    },
    "fnClickHandler": (formdata, house, rel) => {
        if (rel === "save") {
            const state = $("#stateInput").val();
            const mutedUntil = state === "muted" ? $("#dt").data("DateTimePicker").date() : undefined;
            
            // update
            fetcher.graphql(`mutation{updateDeviceWatchdog(data:{id:"${formdata.device.id}",notify:"${state}", muted_until: ${mutedUntil ? `"${mutedUntil.toISOString()}"` : "\"\""}}){id,name}}`).then(() => {
                // close form
                removeForm();    
            })
        }
    }
}

const HOUSE_ACCESS = {
    "name": "houseaccess",
    "html": (formname, ctx) => {
        return `<div class="modal fade" id="${formname}Modal" tabindex="-1" role="dialog" aria-labelledby="${formname}ModalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="${formname}ModalLabel">House Access</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <p>
                Search by email for the user to grant access to the house and click Add to add the 
                user to the list below. To remove a user click the "-" icon next to the name. 
                Existing users are listed in regular font, users you are adding 
                are shown in italics nd users you are removing are shown as strikethough. Click Save to 
                effectuate the changes. You as the owner are not shown.
                </p>
                <div class="color-red" id="${formname}Error"></div>
                ${textField("email", "Email", "Specify the email address of the user to grant access")}
                ${button("Add", "add")}
                <div class="mt-2" id="${formname}Users"></div>
            </div>
            <div class="modal-footer">
                ${button("Save", "save")}
                ${buttonClose("Cancel")}
            </div>
        </div>
    </div>
</div>`
    },
    "users": [],
    "emails": new Set(),
    "_addUser": (formdata, u) => {
        const elem = $("#houseaccessUsers");
        elem.append(`
        <div class="row mb-1" id="user-${u.id}">
            <div class="col-1">${button("-", `remove-${u.id}`, ["btn-danger", "sensorcentral-btn-small"])}</div>
            <div class="col ${u.action === "add" ? "text-italic" : u.action === "remove" ? "text-strikethrough" : ""}">${u.fn} ${u.ln} (${u.email})</div>
        </div>`);
        formdata.users.push(u);
        formdata.emails.add(u.email);
    },
    "_rebuildUsers": (formdata) => {
        const elem = $("#houseaccessUsers");
        elem.html("");
        formdata.users.forEach(u => {
            elem.append(`
            <div class="row mb-1" id="user-${u.id}">
                <div class="col-1">${button("-", `remove-${u.id}`, ["btn-danger", "sensorcentral-btn-small"])}</div>
                <div class="col ${u.action === "add" ? "text-italic" : u.action === "remove" ? "text-strikethrough" : ""}">${u.fn} ${u.ln} (${u.email})</div>
            </div>`);
        })
    },
    "fnClickHandler": (formdata, house, rel) => {
        if (rel.indexOf("remove-") === 0) {
            const id = rel.substring(7);
            formdata.users = formdata.users.reduce((prev, u) => {
                if (u.id !== id) {
                    prev.push(u);
                } else if (u.action === "add") {
                    // was added - remove completely
                } else {
                    u.action = "remove";
                    prev.push(u);
                }
                return prev;
            }, [])
            formdata.emails = new Set(formdata.users.map(u => u.email));
            formdata.users.filter(u => u.id === id).forEach(u => u.action = u.action = "remove");
            formdata._rebuildUsers(formdata);

        } else if (rel === "add") {
            const elemError = $("#houseaccessError");
            const elem = $("#emailInput");
            const email = elem.val().trim();

            if (!email || !email.trim().length) return;
            if (formdata.emails.has(email)) {
                elemError.text(`User with email (${email}) already have access.`);
                elem.text("");
                return;
            }
            
            // load user
            fetcher.graphql(`{user(email: "${email}"){id,fn,ln,email}}`).then(data => {
                data.user.action = "add";
                formdata._addUser(formdata, data.user);
                
                // clear field
                elem.val("");
                elemError.text("");

            }).catch(err => {
                elemError.text(`Unable to find user with email (${email})`);
            })
            
        } else if (rel === "save") {
            fetcher.graphql(`mutation {
                addHouseUsers(data: {houseId: "${house.id}", ids: [${formdata.users.filter(u => u.action === "add").map(u => {
                    return `"${u.id}"`
                })}]})
                removeHouseUsers(data: {houseId: "${house.id}", ids: [${formdata.users.filter(u => u.action === "remove").map(u => {
                    return `"${u.id}"`
                })}]})
            }`)
            removeForm();
        }
    },
    "fnInit": (formdata, ctx) => {
        // reset
        formdata.users = [];
        formdata.emails = new Set();

        // get uers
        return fetcher.graphql(`{houseUsers(id: "${ctx.id}"){id,fn,ln,email}}`).then(data => {
            const elem = $("#houseaccessUsers");
            const me = storage.getUser();
            data.houseUsers.filter(u => u.id !== me.id).forEach(u => {
                u.action = "";
                formdata._addUser(formdata, u);
            })
        })
    }
}

const ERROR_FORM = {
    "name": "error",
    "html": (formname, ctx) => {
        return `<div class="modal fade" id="${formname}Modal" tabindex="-1" role="dialog" aria-labelledby="${formname}ModalLabel" aria-hidden="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="${formname}ModalLabel">Oooops!</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                ${ctx.message}
            </div>
            <div class="modal-footer">
                ${buttonPerformAction("Logout")}
                ${buttonClose()}
            </div>
        </div>
    </div>
</div>`}
}

const SETTINGS = {
    name: "settings",
    html: `<div class="modal fade" id="settingsModal" tabindex="-1" role="dialog" aria-labelledby="${
        this.name
    }ModalLabel" aria-hidden="true">
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
                    ${dropdown(
                        "notify",
                        "Notify Using",
                        "Specify the way you'd like to get notified.",
                        {
                            pushover: "Pushover",
                            email: "Email",
                        },
                        true
                    )}
                    ${textField("pushoverApptoken", "Pushover App Token", "Specify the Pushover App Token")}
                    ${textField("pushoverUserkey", "Pushover User Key", "Specify the Pushover App Token")}
                    ${disabledTextField("yourJWT", "Your JWT", "This is the JWT used to authorize your access. You may use this for API access if required.")}
                </form>
                <div class="mt-3">
                    
                </div>
            </div>
            <div class="modal-footer">
                ${buttonClose()}
                ${buttonPerformAction()}
            </div>
        </div>
    </div>
</div>`,
    fnInit: (formdata, ctx) => {
        const apptokenField = $("#pushoverApptokenInput");
        const userkeyField = $("#pushoverUserkeyInput");
        const notifyField = $("#notifyInput");
        const jwtField = $("#yourJWTInput");
        apptokenField.val(ctx.pushover_apptoken);
        userkeyField.val(ctx.pushover_userkey);
        notifyField.val(ctx.notify_using);

        jwtField.val(storage.getJWT());

        return Promise.resolve();
    },
    fnGetData: () => {
        const apptokenField = $("#pushoverApptokenInput");
        const userkeyField = $("#pushoverUserkeyInput");
        const notifyField = $("#notifyInput");
        return {
            notify_using: notifyField.val(),
            pushover_apptoken: apptokenField.val(),
            pushover_userkey: userkeyField.val(),
        };
    },
};



const prepareForm = (formdata, ctx, onPerformAction) => {
    const elem = $(`#${ID_ELEM_FORM}`);
    let htmlReturn;
    if (typeof formdata.html === "function") {
        htmlReturn = formdata.html(formdata.name, ctx.form);
    } else {
        htmlReturn = formdata.html;
    }
    if (typeof htmlReturn === "object") {
        elem.html(htmlReturn.html);
        if (htmlReturn.callback && typeof htmlReturn.callback === "function") {
            htmlReturn.callback();
        }
    } else {
        elem.html(htmlReturn);
    }

    new Promise((resolve, reject) => {
        if (formdata.fnInit && typeof formdata.fnInit === "function") {
            formdata.fnInit(formdata, ctx).then(resolve).catch(err => {
                reject(err);
            });
        } else {
            resolve();
        }
    }).then(() => {
        // show dialog
        $(`#${formdata.name}Modal`).modal("show");

        // support for click handlers
        if (formdata.fnClickHandler && typeof formdata.fnClickHandler === "function") {
            $(`#${formdata.name}Modal`).on("click", (evt) => {
                const rel = evt.target.getAttribute("rel");
                if (rel) {
                    formdata.fnClickHandler(formdata, ctx, rel);
                }
            })
        }

        // add save handler
        $("#performAction").on("click", () => {
            // validate form
            const form = document.querySelector(`#${formdata.name}Form`);
            if (form && !form.checkValidity()) {
                form.classList.add('was-validated');
                return;
            }

            // get data
            const data = formdata.hasOwnProperty("fnGetData") ? formdata.fnGetData(formdata) : {};

            // remove form
            removeForm();

            // callback
            if (onPerformAction) onPerformAction(data);
        });
    }).catch(err => {
        appendError(err);
    })
}



module.exports = {
    appendManualSampleForm: (sensor, onPerformAction) => {
        prepareForm(MANUAL_SENSOR_SAMPLE, {"sensor": sensor}, onPerformAction);
    },
    appendDateSelectForm: (ctx, onPerformAction) => {
        prepareForm(DATE_SELECT_FORM, ctx, onPerformAction);
    },
    appendIntervalSelectForm: (ctx, onPerformAction) => {
        prepareForm(INTERVAL_SELECT_FORM, ctx, onPerformAction);
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
    appendWatchdogEditForm: (device, onPerformAction) => {
        prepareForm(DEVICE_EDIT_WATCHDOG, device, onPerformAction);
    },
    appendSensorCreateEditForm: (sensor, onPerformAction) => {
        prepareForm(SENSOR_CREATE_EDIT, {"sensor": sensor}, onPerformAction);
    },
    appendTrashForm: (ctx, onPerformAction) => {
        prepareForm(DELETE_ENTITY, ctx, onPerformAction);
    },
    appendSettings: (ctx, onPerformAction) => {
        prepareForm(SETTINGS, ctx, onPerformAction);
    },
    appendError,
    appendHouseAccessForm: (ctx, onPerformAction) => {
        prepareForm(HOUSE_ACCESS, ctx, onPerformAction);
    },
    utils: {
        textField,
        toggleButton,
        dropdown,
        disabledTextField,
        buttonClose,
        buttonPerformAction,
        logout
    }

}