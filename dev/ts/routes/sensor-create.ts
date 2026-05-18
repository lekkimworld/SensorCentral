import { v4 as uuid } from "uuid";
import { graphql } from "../fetch-util";
import { createContainers } from "../ui-helper";
import * as uiutils from "../ui-utils";

export default async (elemRoot: JQuery<HTMLElement>, houseId: string, deviceId: string) => {
    const container = createContainers(elemRoot, "sensor-create", "title", "form");
    const titleElem = container.children!.title.elem;
    const formElem = container.children!.form.elem;

    uiutils.appendTitleRow(titleElem, "Create Sensor");

    formElem.html(`
        <form id="sensorCreateForm" novalidate>
            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="idInput">ID</label>
                        <input type="text" required class="form-control" id="idInput" value="${uuid()}" maxlength="36" minlength="2">
                        <small class="form-text text-muted">Auto-generated UUID. You may override with your own ID (maximum 36 characters).</small>
                        <div class="invalid-feedback">You must specify the ID for the sensor. Must be unique.</div>
                    </div>
                    <div class="form-group">
                        <label for="nameInput">Name</label>
                        <input type="text" required class="form-control" id="nameInput" placeholder="Enter sensor name" maxlength="128" minlength="2">
                        <small class="form-text text-muted">Specify the name of the sensor (maximum 128 characters).</small>
                        <div class="invalid-feedback">You must specify the name for the sensor. Must be unique.</div>
                    </div>
                    <div class="form-group">
                        <label for="typeInput">Type</label>
                        <select class="form-control" id="typeInput" required>
                            <option value="gauge">Gauge (value goes up/down e.g. temperature)</option>
                            <option value="counter">Counter (value only increases)</option>
                            <option value="delta">Delta (sensor sends change only, scale factor may apply)</option>
                            <option value="binary">Binary (on/off)</option>
                        </select>
                        <small class="form-text text-muted">Specify the type of the sensor.</small>
                    </div>
                    <div class="form-group">
                        <label for="iconInput">Icon</label>
                        <select class="form-control" id="iconInput" required>
                            <option value="battery-4">Power</option>
                            <option value="thermometer-empty">Temperature</option>
                            <option value="tint">Humidity</option>
                            <option value="tachometer">Tachometer</option>
                            <option value="toggle-off">On/off</option>
                        </select>
                        <small class="form-text text-muted">Specify the icon for the sensor.</small>
                    </div>
                    <div class="form-group">
                        <label for="scalefactorInput">Scale Factor</label>
                        <select class="form-control" id="scalefactorInput">
                            <option value="1">1</option>
                            <option value="0.1">1/10</option>
                            <option value="0.01">1/100</option>
                            <option value="0.001">1/1000</option>
                        </select>
                        <small class="form-text text-muted">Factor applied to values for display.</small>
                    </div>
                    <div class="form-group">
                        <label for="labelInput">Label</label>
                        <input type="text" class="form-control" id="labelInput" placeholder="Enter label (optional)" maxlength="128">
                        <small class="form-text text-muted">Specify the label of the sensor (maximum 128 characters).</small>
                    </div>
                    <div class="form-group form-check">
                        <input type="checkbox" class="form-check-input" id="enableTimeoutInput">
                        <label class="form-check-label" for="enableTimeoutInput">Enable Timeout</label>
                        <small class="form-text text-muted">Enable watchdog monitoring for this sensor. A timeout event fires if no data is received within the specified period.</small>
                    </div>
                    <div id="timeout-section" class="hidden">
                        <div class="form-group">
                            <label for="timeoutSecondsInput">Timeout (seconds)</label>
                            <input type="number" class="form-control" id="timeoutSecondsInput" value="600" min="1">
                            <small class="form-text text-muted">Number of seconds of inactivity before a timeout event is raised.</small>
                        </div>
                    </div>
                </div>
            </div>
            <hr>
            <button type="button" class="btn btn-primary mr-2" id="saveSensor">Save</button>
            <a href="#configuration/house/${houseId}/device/${deviceId}" class="btn btn-secondary">Back</a>
        </form>
    `);

    document.getElementById("enableTimeoutInput")?.addEventListener("change", () => {
        const checked = (document.getElementById("enableTimeoutInput") as HTMLInputElement).checked;
        document.getElementById("timeout-section")!.classList.toggle("hidden", !checked);
    });

    document.getElementById("saveSensor")?.addEventListener("click", async () => {
        const form = document.getElementById("sensorCreateForm") as HTMLFormElement;
        if (!form.checkValidity()) {
            form.classList.add("was-validated");
            return;
        }

        const id = (document.getElementById("idInput") as HTMLInputElement).value;
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
            `mutation {createSensor(data: {deviceId: "${deviceId}", id: "${id}", name: "${name}", label: "${label}", type: ${type}, icon: "${icon}", scaleFactor: ${scaleFactor}, timeoutSeconds: ${timeoutSeconds}}){id}}`
        );
        document.location.hash = `#configuration/house/${houseId}/device/${deviceId}`;
    });
};
