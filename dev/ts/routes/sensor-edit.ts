import { graphql } from "../fetch-util";
import { createContainers } from "../ui-helper";
import * as uiutils from "../ui-utils";

export default async (elemRoot: JQuery<HTMLElement>, houseId: string, deviceId: string, sensorId: string) => {
    const container = createContainers(elemRoot, "sensor-edit", "title", "form");
    const titleElem = container.children!.title.elem;
    const formElem = container.children!.form.elem;

    const data = await graphql(`{sensor(id:"${sensorId}"){id,name,label,icon,type,scaleFactor,timeoutSeconds}}`);
    const sensor = data.sensor;

    if (!sensor) {
        formElem.html(`<div class="alert alert-danger">Sensor not found.</div><a href="#configuration/house/${houseId}/device/${deviceId}" class="btn btn-secondary">Back</a>`);
        return;
    }

    const hasTimeout = sensor.timeoutSeconds != null;

    uiutils.appendTitleRow(titleElem, "Edit Sensor");

    formElem.html(`
        <form id="sensorEditForm" novalidate>
            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="idInput">ID</label>
                        <input type="text" class="form-control" id="idInput" value="${sensor.id}" disabled>
                    </div>
                    <div class="form-group">
                        <label for="nameInput">Name</label>
                        <input type="text" required class="form-control" id="nameInput" value="${sensor.name}" maxlength="128" minlength="2">
                        <small class="form-text text-muted">Specify the name of the sensor (maximum 128 characters).</small>
                        <div class="invalid-feedback">You must specify the name for the sensor. Must be unique.</div>
                    </div>
                    <div class="form-group">
                        <label for="typeInput">Type</label>
                        <select class="form-control" id="typeInput" required>
                            <option value="gauge" ${sensor.type === "gauge" ? "selected" : ""}>Gauge (value goes up/down e.g. temperature)</option>
                            <option value="counter" ${sensor.type === "counter" ? "selected" : ""}>Counter (value only increases)</option>
                            <option value="delta" ${sensor.type === "delta" ? "selected" : ""}>Delta (sensor sends change only, scale factor may apply)</option>
                            <option value="binary" ${sensor.type === "binary" ? "selected" : ""}>Binary (on/off)</option>
                        </select>
                        <small class="form-text text-muted">Specify the type of the sensor.</small>
                    </div>
                    <div class="form-group">
                        <label for="iconInput">Icon</label>
                        <select class="form-control" id="iconInput" required>
                            <option value="battery-4" ${sensor.icon === "battery-4" ? "selected" : ""}>Power</option>
                            <option value="thermometer-empty" ${sensor.icon === "thermometer-empty" ? "selected" : ""}>Temperature</option>
                            <option value="tint" ${sensor.icon === "tint" ? "selected" : ""}>Humidity</option>
                            <option value="tachometer" ${sensor.icon === "tachometer" ? "selected" : ""}>Tachometer</option>
                            <option value="toggle-off" ${sensor.icon === "toggle-off" ? "selected" : ""}>On/off</option>
                        </select>
                        <small class="form-text text-muted">Specify the icon for the sensor.</small>
                    </div>
                    <div class="form-group">
                        <label for="scalefactorInput">Scale Factor</label>
                        <select class="form-control" id="scalefactorInput">
                            <option value="1" ${sensor.scaleFactor == 1 ? "selected" : ""}>1</option>
                            <option value="0.1" ${sensor.scaleFactor == 0.1 ? "selected" : ""}>1/10</option>
                            <option value="0.01" ${sensor.scaleFactor == 0.01 ? "selected" : ""}>1/100</option>
                            <option value="0.001" ${sensor.scaleFactor == 0.001 ? "selected" : ""}>1/1000</option>
                        </select>
                        <small class="form-text text-muted">Factor applied to values for display.</small>
                    </div>
                    <div class="form-group">
                        <label for="labelInput">Label</label>
                        <input type="text" class="form-control" id="labelInput" value="${sensor.label || ""}" maxlength="128">
                        <small class="form-text text-muted">Specify the label of the sensor (maximum 128 characters).</small>
                    </div>
                    <div class="form-group form-check">
                        <input type="checkbox" class="form-check-input" id="enableTimeoutInput" ${hasTimeout ? "checked" : ""}>
                        <label class="form-check-label" for="enableTimeoutInput">Enable Timeout</label>
                        <small class="form-text text-muted">Enable watchdog monitoring for this sensor. A timeout event fires if no data is received within the specified period.</small>
                    </div>
                    <div id="timeout-section" class="${hasTimeout ? "" : "hidden"}">
                        <div class="form-group">
                            <label for="timeoutSecondsInput">Timeout (seconds)</label>
                            <input type="number" class="form-control" id="timeoutSecondsInput" value="${hasTimeout ? sensor.timeoutSeconds : 600}" min="1">
                            <small class="form-text text-muted">Number of seconds of inactivity before a timeout event is raised.</small>
                        </div>
                    </div>
                </div>
            </div>
            <hr>
            <button type="button" class="btn btn-primary mr-2" id="saveSensor">Save</button>
            <a href="#configuration/house/${houseId}/device/${deviceId}/sensor/${sensorId}" class="btn btn-secondary">Back</a>
        </form>
    `);

    document.getElementById("enableTimeoutInput")?.addEventListener("change", () => {
        const checked = (document.getElementById("enableTimeoutInput") as HTMLInputElement).checked;
        document.getElementById("timeout-section")!.classList.toggle("hidden", !checked);
    });

    document.getElementById("saveSensor")?.addEventListener("click", async () => {
        const form = document.getElementById("sensorEditForm") as HTMLFormElement;
        if (!form.checkValidity()) {
            form.classList.add("was-validated");
            return;
        }

        const name = (document.getElementById("nameInput") as HTMLInputElement).value;
        const type = (document.getElementById("typeInput") as HTMLSelectElement).value;
        const icon = (document.getElementById("iconInput") as HTMLSelectElement).value;
        const scaleFactor = (document.getElementById("scalefactorInput") as HTMLSelectElement).value;
        const label = (document.getElementById("labelInput") as HTMLInputElement).value;
        const enableTimeout = (document.getElementById("enableTimeoutInput") as HTMLInputElement).checked;
        const timeoutSeconds = enableTimeout
            ? parseInt((document.getElementById("timeoutSecondsInput") as HTMLInputElement).value, 10)
            : null;

        await graphql(
            `mutation {updateSensor(data: {id: "${sensorId}", name: "${name}", label: "${label}", type: ${type}, icon: "${icon}", scaleFactor: ${scaleFactor}, timeoutSeconds: ${timeoutSeconds}}){id}}`
        );
        document.location.hash = `#configuration/house/${houseId}/device/${deviceId}/sensor/${sensorId}`;
    });
};
