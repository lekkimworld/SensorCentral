import { Endpoint } from "../clientside-types";
import { graphql } from "../fetch-util";
import { buttonClose, buttonPerformAction, Form, EVENTS, DataEvent, UICatalog, InitEvent, ToggleButtonControl, TextControl, buttonPerformDestructiveAction, ClickEvent } from "../forms-util";

export class EndpointForm extends Form<Endpoint> {
    constructor(endpoint?: Endpoint) {
        super("createEndpoint", endpoint ? "Edit Endpoint" : "Create Endpoint", endpoint);
        this.addEventListener("click", async e => {
            const ev = e as ClickEvent;
            const rel = ev.rel;
            if ("delete" === rel) {
                if (!confirm("Are you sure?")) return;
                await graphql(`mutation {
                    deleteEndpoint(data: {id: "${endpoint?.id}"})
                }`)
                document.location.reload();
            }
        })
        this.addEventListener(EVENTS.data, async e => {
            const dataEvent = e as DataEvent;
            const data = dataEvent.data;
            const id = data.id;
            if (id) {
                // update
                await graphql(`mutation {
                    updateEndpoint(data: {
                        id: "${data.id}" 
                        name: "${data.name}"  
                        baseUrl: "${data.baseUrl}" 
                        ${data.bearerToken ? `bearerToken: "${data.bearerToken}"` : ""}
                    }) {id}}`);
            } else {
                // create
                await graphql(`mutation {createEndpoint(data: {
                    name: "${data.name}" 
                    baseUrl: "${data.baseUrl}"  
                    ${data.bearerToken ? `bearerToken: "${data.bearerToken}"` : ""}
                }){id}}`);
            }
            document.location.reload();
        })
        this.addEventListener("init", (ev: Event) => {
            const catalog = (ev as InitEvent).catalog;
            const toggle = catalog.get("enableBearerToken") as ToggleButtonControl;
            const bearerToken = catalog.get("bearerToken") as TextControl;
            toggle.onChange(() => {
                if (toggle.checked) {
                    bearerToken.enable();
                } else {
                    bearerToken.disable();
                }
            });
            if (this.ctx) {
                catalog.get("name").value = this.ctx.name!;
                catalog.get("baseUrl").value = this.ctx.baseUrl!;
                catalog.get("bearerToken").value = this.ctx.bearerToken!;
            }
        })
    }

    body(catalog: UICatalog) {
        return `<form id="${this.name}Form" novalidate>
            ${catalog.textField({
                name: "name",
                label: "Name",
                placeholder: "Enter endpoint name",
                fieldExplanation: "Specify the name of the endpoint (maximum 128 characters).",
                required: true,
                validationText: "You must specify the name for the endpoint.",
            })}
            ${catalog.textField({
                name: "baseUrl",
                label: "Base URL",
                placeholder: "Specify the base URL",
                fieldExplanation: "Specify the base URL for requests to this endpoint (maximum 1024 characters).",
                required: true,
                validationText: "You must specify the base URL for the endpoint.",
            })}
            ${catalog.toggleButton({
                name: "enableBearerToken",
                label: "Enable Bearer Token",
                on: false,
                fieldExplanation: "Toggle on to set / update the bearer token"
            })}
            ${catalog.textField({
                name: "bearerToken",
                label: "Bearer Token",
                placeholder: "Specify the bearer token (if applicable)",
                fieldExplanation: "Specify the bearer token for requests to this endpoint if applicable (maximum 1024 characters).",
                required: false,
                disabled: true
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
        const data = {
            id: this.ctx?.id,
            name: catalog.value("name"),
            baseUrl: catalog.value("baseUrl"),
        };
        if ((catalog.get("enableBearerToken") as ToggleButtonControl).checked) {
            data["bearerToken"] = catalog.value("bearerToken")
        }
        return data;
    }
}
