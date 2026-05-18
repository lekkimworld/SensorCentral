import { graphql } from "../fetch-util";
import { createContainers } from "../ui-helper";
import * as uiutils from "../ui-utils";

const SENSOR_TRIGGERS: Record<string, string> = {
    onSensorSample: "On Sensor Sample",
    onSensorTimeout: "On Sensor Timeout",
};

const DEVICE_TRIGGERS: Record<string, string> = {
    onDeviceTimeout: "On Device Timeout",
};

const ACTION_TYPES: Record<string, string> = {
    persist_value: "Persist Value",
    callout: "Callout",
};

type CalloutOption = { id: string; name: string };

export default async (elemRoot: JQuery<HTMLElement>, targetId: string, targetType: string) => {
    const container = createContainers(elemRoot, "eventdef-create", "title", "form");
    const titleElem = container.children!.title.elem;
    const formElem = container.children!.form.elem;

    const data = await graphql(`{ callouts { id, name } }`);
    const callouts: CalloutOption[] = data.callouts || [];

    const isDevice = targetType === "device";
    const triggers = isDevice ? DEVICE_TRIGGERS : SENSOR_TRIGGERS;

    uiutils.appendTitleRow(titleElem, "Create Event Definition");

    const triggerOptions = Object.entries(triggers).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
    const actionOptions = Object.entries(ACTION_TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
    const calloutOptions = callouts.map(c => `<option value="${c.id}">${c.name}</option>`).join("");

    formElem.html(`
        <form id="eventdefCreateForm" novalidate>
            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="triggerTypeInput">Trigger</label>
                        <select class="form-control" id="triggerTypeInput" required>
                            <option></option>
                            ${triggerOptions}
                        </select>
                        <small class="form-text text-muted">When should this event fire?</small>
                        <div class="invalid-feedback">You must select a trigger type.</div>
                    </div>
                    <div class="form-group">
                        <label for="actionTypeInput">Action</label>
                        <select class="form-control" id="actionTypeInput" required>
                            <option></option>
                            ${actionOptions}
                        </select>
                        <small class="form-text text-muted">What should happen when the event fires?</small>
                        <div class="invalid-feedback">You must select an action type.</div>
                    </div>
                    <div class="form-group" id="calloutIdGroup" style="display:none">
                        <label for="calloutIdInput">Callout</label>
                        <select class="form-control" id="calloutIdInput">
                            <option></option>
                            ${calloutOptions}
                        </select>
                        <small class="form-text text-muted">Select the callout to execute.</small>
                    </div>
                    <div class="form-group" id="persistValueGroup" style="display:none">
                        <label for="persistValueInput">Value</label>
                        <input type="number" class="form-control" id="persistValueInput" step="any" placeholder="Enter value to persist">
                        <small class="form-text text-muted">The value to write to the sensor when the event fires.</small>
                    </div>
                </div>
            </div>
            <hr>
            <button type="button" class="btn btn-primary mr-2" id="saveEventDef">Save</button>
            <a href="${isDevice ? `#configuration/house/` : `#`}" class="btn btn-secondary" id="backBtn">Back</a>
        </form>
    `);

    // Set back link based on referrer (go back in history)
    document.getElementById("backBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        history.back();
    });

    const toggleActionFields = () => {
        const actionType = (document.getElementById("actionTypeInput") as HTMLSelectElement).value;
        document.getElementById("calloutIdGroup")!.style.display = actionType === "callout" ? "" : "none";
        document.getElementById("persistValueGroup")!.style.display = actionType === "persist_value" ? "" : "none";
    };

    document.getElementById("actionTypeInput")?.addEventListener("change", toggleActionFields);

    document.getElementById("saveEventDef")?.addEventListener("click", async () => {
        const form = document.getElementById("eventdefCreateForm") as HTMLFormElement;
        if (!form.checkValidity()) {
            form.classList.add("was-validated");
            return;
        }

        const triggerType = (document.getElementById("triggerTypeInput") as HTMLSelectElement).value;
        const actionType = (document.getElementById("actionTypeInput") as HTMLSelectElement).value;
        let actionConfig: string;
        if (actionType === "callout") {
            const calloutId = (document.getElementById("calloutIdInput") as HTMLSelectElement).value;
            actionConfig = JSON.stringify({ calloutId });
        } else {
            const value = parseFloat((document.getElementById("persistValueInput") as HTMLInputElement).value) || 0;
            actionConfig = JSON.stringify({ value });
        }

        await graphql(`mutation {
            createEventDefinition(data: {
                ${isDevice ? "deviceId" : "sensorId"}: "${targetId}"
                triggerType: ${triggerType}
                actionType: ${actionType}
                actionConfig: ${JSON.stringify(actionConfig)}
            }) { id }
        }`);
        history.back();
    });
};
