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

export default async (elemRoot: JQuery<HTMLElement>, eventDefId: string, targetType: string, targetId: string) => {
    const container = createContainers(elemRoot, "eventdef-edit", "title", "form");
    const titleElem = container.children!.title.elem;
    const formElem = container.children!.form.elem;

    const data = await graphql(`{
        callouts { id, name }
        eventDefinitions(targetId: "${targetId}") { id, triggerType, actionType, actionConfig, active }
    }`);
    const callouts: CalloutOption[] = data.callouts || [];
    const defs = data.eventDefinitions || [];
    const def = defs.find((d: any) => d.id === eventDefId);

    if (!def) {
        formElem.html(`<div class="alert alert-danger">Event definition not found.</div>`);
        return;
    }

    const isDevice = targetType === "device";
    const triggers = isDevice ? DEVICE_TRIGGERS : SENSOR_TRIGGERS;
    const config = JSON.parse(def.actionConfig || "{}");

    uiutils.appendTitleRow(titleElem, "Edit Event Definition");

    const triggerOptions = Object.entries(triggers).map(([k, v]) => `<option value="${k}" ${def.triggerType === k ? "selected" : ""}>${v}</option>`).join("");
    const actionOptions = Object.entries(ACTION_TYPES).map(([k, v]) => `<option value="${k}" ${def.actionType === k ? "selected" : ""}>${v}</option>`).join("");
    const calloutOptions = callouts.map(c => `<option value="${c.id}" ${config.calloutId === c.id ? "selected" : ""}>${c.name}</option>`).join("");

    formElem.html(`
        <form id="eventdefEditForm" novalidate>
            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="triggerTypeInput">Trigger</label>
                        <select class="form-control" id="triggerTypeInput" required>
                            <option></option>
                            ${triggerOptions}
                        </select>
                        <small class="form-text text-muted">When should this event fire?</small>
                    </div>
                    <div class="form-group">
                        <label for="actionTypeInput">Action</label>
                        <select class="form-control" id="actionTypeInput" required>
                            <option></option>
                            ${actionOptions}
                        </select>
                        <small class="form-text text-muted">What should happen when the event fires?</small>
                    </div>
                    <div class="form-group" id="calloutIdGroup" style="${def.actionType === "callout" ? "" : "display:none"}">
                        <label for="calloutIdInput">Callout</label>
                        <select class="form-control" id="calloutIdInput">
                            <option></option>
                            ${calloutOptions}
                        </select>
                        <small class="form-text text-muted">Select the callout to execute.</small>
                    </div>
                    <div class="form-group" id="persistValueGroup" style="${def.actionType === "persist_value" ? "" : "display:none"}">
                        <label for="persistValueInput">Value</label>
                        <input type="number" class="form-control" id="persistValueInput" step="any" value="${config.value ?? ""}">
                        <small class="form-text text-muted">The value to write to the sensor when the event fires.</small>
                    </div>
                    <div class="form-group">
                        <label for="activeInput">Active</label>
                        <select class="form-control" id="activeInput">
                            <option value="true" ${def.active ? "selected" : ""}>Yes</option>
                            <option value="false" ${!def.active ? "selected" : ""}>No</option>
                        </select>
                        <small class="form-text text-muted">Whether this event definition is active.</small>
                    </div>
                </div>
            </div>
            <hr>
            <button type="button" class="btn btn-primary mr-2" id="saveEventDef">Save</button>
            <button type="button" class="btn btn-danger mr-2" id="deleteEventDef">Delete</button>
            <button type="button" class="btn btn-secondary" id="backBtn">Back</button>
        </form>
    `);

    document.getElementById("backBtn")?.addEventListener("click", () => history.back());

    const toggleActionFields = () => {
        const actionType = (document.getElementById("actionTypeInput") as HTMLSelectElement).value;
        document.getElementById("calloutIdGroup")!.style.display = actionType === "callout" ? "" : "none";
        document.getElementById("persistValueGroup")!.style.display = actionType === "persist_value" ? "" : "none";
    };

    document.getElementById("actionTypeInput")?.addEventListener("change", toggleActionFields);

    document.getElementById("saveEventDef")?.addEventListener("click", async () => {
        const form = document.getElementById("eventdefEditForm") as HTMLFormElement;
        if (!form.checkValidity()) {
            form.classList.add("was-validated");
            return;
        }

        const triggerType = (document.getElementById("triggerTypeInput") as HTMLSelectElement).value;
        const actionType = (document.getElementById("actionTypeInput") as HTMLSelectElement).value;
        const active = (document.getElementById("activeInput") as HTMLSelectElement).value === "true";
        let actionConfig: string;
        if (actionType === "callout") {
            const calloutId = (document.getElementById("calloutIdInput") as HTMLSelectElement).value;
            actionConfig = JSON.stringify({ calloutId });
        } else {
            const value = parseFloat((document.getElementById("persistValueInput") as HTMLInputElement).value) || 0;
            actionConfig = JSON.stringify({ value });
        }

        await graphql(`mutation {
            updateEventDefinition(data: {
                id: "${eventDefId}"
                triggerType: ${triggerType}
                actionType: ${actionType}
                actionConfig: ${JSON.stringify(actionConfig)}
                active: ${active}
            }) { id }
        }`);
        history.back();
    });

    document.getElementById("deleteEventDef")?.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to delete this event definition?")) return;
        await graphql(`mutation { deleteEventDefinition(id: "${eventDefId}") }`);
        history.back();
    });
};
