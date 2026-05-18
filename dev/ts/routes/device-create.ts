import { v4 as uuid } from "uuid";
import { graphql } from "../fetch-util";
import { createContainers } from "../ui-helper";
import * as uiutils from "../ui-utils";

export default async (elemRoot: JQuery<HTMLElement>, houseId: string) => {
    const container = createContainers(elemRoot, "device-create", "title", "form");
    const titleElem = container.children!.title.elem;
    const formElem = container.children!.form.elem;

    uiutils.appendTitleRow(titleElem, "Create Device");

    formElem.html(`
        <form id="deviceCreateForm" novalidate>
            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="idInput">ID</label>
                        <input type="text" required class="form-control" id="idInput" value="${uuid()}" maxlength="36" minlength="2">
                        <small class="form-text text-muted">Auto-generated UUID. You may override with your own ID (maximum 36 characters).</small>
                        <div class="invalid-feedback">You must specify the ID for the device. Must be unique.</div>
                    </div>
                    <div class="form-group">
                        <label for="nameInput">Name</label>
                        <input type="text" required class="form-control" id="nameInput" placeholder="Enter device name" maxlength="128" minlength="2">
                        <small class="form-text text-muted">Specify the name of the device (maximum 128 characters).</small>
                        <div class="invalid-feedback">You must specify the name for the device. Must be unique.</div>
                    </div>
                    <div class="form-group form-check">
                        <input type="checkbox" class="form-check-input" id="activeInput" checked>
                        <label class="form-check-label" for="activeInput">Active</label>
                        <small class="form-text text-muted">Making a device inactive sorts it at the bottom and disables any alerts for the device.</small>
                    </div>
                    <div class="form-group form-check">
                        <input type="checkbox" class="form-check-input" id="enableTimeoutInput">
                        <label class="form-check-label" for="enableTimeoutInput">Enable Timeout</label>
                        <small class="form-text text-muted">Enable watchdog monitoring for this device. A timeout event fires if no data is received within the specified period.</small>
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
            <button type="button" class="btn btn-primary mr-2" id="saveDevice">Save</button>
            <a href="#configuration/house/${houseId}" class="btn btn-secondary">Back</a>
        </form>
    `);

    document.getElementById("enableTimeoutInput")?.addEventListener("change", () => {
        const checked = (document.getElementById("enableTimeoutInput") as HTMLInputElement).checked;
        document.getElementById("timeout-section")!.classList.toggle("hidden", !checked);
    });

    document.getElementById("saveDevice")?.addEventListener("click", async () => {
        const form = document.getElementById("deviceCreateForm") as HTMLFormElement;
        if (!form.checkValidity()) {
            form.classList.add("was-validated");
            return;
        }

        const id = (document.getElementById("idInput") as HTMLInputElement).value;
        const name = (document.getElementById("nameInput") as HTMLInputElement).value;
        const active = (document.getElementById("activeInput") as HTMLInputElement).checked;
        const enableTimeout = (document.getElementById("enableTimeoutInput") as HTMLInputElement).checked;
        const timeoutSeconds = enableTimeout
            ? parseInt((document.getElementById("timeoutSecondsInput") as HTMLInputElement).value, 10)
            : null;

        await graphql(
            `mutation {createDevice(data: {houseId: "${houseId}", id: "${id}", name: "${name}", active: ${active}, timeoutSeconds: ${timeoutSeconds}}){id}}`
        );
        document.location.hash = `#configuration/house/${houseId}`;
    });
};
