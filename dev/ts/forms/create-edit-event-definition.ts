import { Callout, Device, EventDefinition, Sensor } from "../clientside-types";
import { graphql } from "../fetch-util";
import { buttonClose, buttonPerformAction, buttonPerformDestructiveAction, ClickEvent, DataEvent, EVENTS, Form, InitEvent, UICatalog } from "../forms-util";

type RequestedCallout = Readonly<Pick<Callout, "id" | "name">>;

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

export class EventDefinitionForm extends Form<EventDefinition> {
    private targetId: string;
    private isDevice: boolean;
    private callouts: Array<RequestedCallout> = [];

    constructor(target: Device | Sensor, isDevice: boolean, ev?: EventDefinition) {
        super("eventDefinition", ev ? "Edit Event Definition" : "Create Event Definition", ev);
        this.targetId = target.id!;
        this.isDevice = isDevice;

        this.addEventListener("click", async (e) => {
            const ev = e as ClickEvent;
            if ("delete" === ev.rel) {
                if (!confirm("Are you sure?")) return;
                await graphql(`mutation { deleteEventDefinition(id: "${this.ctx!.id}") }`);
                document.location.reload();
            }
        });

        this.addEventListener(EVENTS.data, async (e) => {
            const data = (e as DataEvent).data;
            const actionConfig = data.actionType === "callout"
                ? JSON.stringify({ calloutId: data.calloutId })
                : JSON.stringify({ value: Number(data.persistValue) || 0 });

            if (this.ctx?.id) {
                await graphql(`mutation {
                    updateEventDefinition(data: {
                        id: "${this.ctx.id}"
                        triggerType: ${data.triggerType}
                        actionType: ${data.actionType}
                        actionConfig: ${JSON.stringify(actionConfig)}
                        active: ${data.active === "true"}
                    }) { id }
                }`);
            } else {
                await graphql(`mutation {
                    createEventDefinition(data: {
                        ${isDevice ? "deviceId" : "sensorId"}: "${this.targetId}"
                        triggerType: ${data.triggerType}
                        actionType: ${data.actionType}
                        actionConfig: ${JSON.stringify(actionConfig)}
                    }) { id }
                }`);
            }
            document.location.reload();
        });

        this.addEventListener("init", async (e: Event) => {
            const catalog = (e as InitEvent).catalog;
            if (this.ctx) {
                catalog.get("triggerType").value = this.ctx.triggerType!;
                catalog.get("actionType").value = this.ctx.actionType!;
                catalog.get("active").value = this.ctx.active ? "true" : "false";
                const config = JSON.parse(this.ctx.actionConfig || "{}");
                if (this.ctx.actionType === "callout") {
                    catalog.get("calloutId").value = config.calloutId || "";
                } else {
                    catalog.get("persistValue").value = config.value ?? "";
                }
            }
            this.toggleActionFields(catalog);
            const actionTypeSelect = document.getElementById("actionTypeInput") as HTMLSelectElement;
            actionTypeSelect?.addEventListener("change", () => this.toggleActionFields(catalog));
        });
    }

    private toggleActionFields(catalog: UICatalog) {
        const actionType = catalog.value("actionType");
        const calloutField = document.getElementById("calloutIdInput")?.closest(".form-group") as HTMLElement;
        const persistField = document.getElementById("persistValueInput")?.closest(".form-group") as HTMLElement;
        const persistInput = document.getElementById("persistValueInput") as HTMLInputElement;
        if (calloutField) calloutField.style.display = actionType === "callout" ? "" : "none";
        if (persistField) persistField.style.display = actionType === "persist_value" ? "" : "none";
        if (persistInput) persistInput.required = actionType === "persist_value";
    }

    async loadData(): Promise<void> {
        const data = await graphql(`{ callouts { id, name } }`);
        this.callouts = data.callouts || [];
    }

    body(catalog: UICatalog) {
        const triggers = this.isDevice ? DEVICE_TRIGGERS : SENSOR_TRIGGERS;
        return `<form id="${this.name}Form" novalidate>
            ${catalog.dropdown({
                name: "triggerType",
                label: "Trigger",
                addBlank: true,
                required: true,
                dropdownOptions: triggers,
                fieldExplanation: "When should this event fire?",
            })}
            ${catalog.dropdown({
                name: "actionType",
                label: "Action",
                addBlank: true,
                required: true,
                dropdownOptions: ACTION_TYPES,
                fieldExplanation: "What should happen when the event fires?",
            })}
            ${catalog.dropdown({
                name: "calloutId",
                label: "Callout",
                addBlank: true,
                required: false,
                dropdownOptions: this.callouts.reduce((prev, c) => {
                    prev[c.id!] = c.name!;
                    return prev;
                }, {} as Record<string, string>),
                fieldExplanation: "Select the callout to execute",
            })}
            ${catalog.numberField({
                name: "persistValue",
                label: "Value",
                placeholder: "Enter value to persist",
                fieldExplanation: "The value to write to the sensor when the event fires",
            })}
            ${catalog.dropdown({
                name: "active",
                label: "Active",
                addBlank: false,
                required: true,
                dropdownOptions: {"true": "Yes", "false": "No"},
                fieldExplanation: "Whether this event definition is active",
            })}
        </form>`;
    }

    footer() {
        return `
            ${this.ctx ? buttonPerformDestructiveAction() : ""}
            ${buttonClose()}
            ${buttonPerformAction()}
        `;
    }

    async getData(catalog: UICatalog) {
        return {
            triggerType: catalog.value("triggerType"),
            actionType: catalog.value("actionType"),
            calloutId: catalog.value("calloutId"),
            persistValue: catalog.value("persistValue"),
            active: catalog.value("active"),
        };
    }
}
