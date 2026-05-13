import { CalloutEndpoint } from "../clientside-types";
import { graphql } from "../fetch-util";
import { buttonClose, buttonPerformAction, Form, EVENTS, DataEvent, UICatalog, InitEvent, buttonPerformDestructiveAction, ClickEvent } from "../forms-util";

export class EndpointForm extends Form<CalloutEndpoint> {
    constructor(endpoint?: CalloutEndpoint) {
        super("createEndpoint", endpoint ? "Edit Endpoint" : "Create Endpoint", endpoint);
        this.addEventListener("click", async e => {
            const ev = e as ClickEvent;
            const rel = ev.rel;
            if ("delete" === rel) {
                if (!confirm("Are you sure?")) return;
                await graphql(`mutation {
                    deleteCalloutEndpoint(data: {id: "${endpoint?.id}"})
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
                    updateCalloutEndpoint(data: {
                        id: "${data.id}" 
                        name: "${data.name}"  
                        baseUrl: "${data.baseUrl}" 
                    }) {id}}`);
            } else {
                // create
                await graphql(`mutation {createCalloutEndpoint(data: {
                    name: "${data.name}" 
                    baseUrl: "${data.baseUrl}"  
                }){id}}`);
            }
            document.location.reload();
        })
        this.addEventListener("init", (ev: Event) => {
            const catalog = (ev as InitEvent).catalog;
            if (this.ctx) {
                catalog.get("name").value = this.ctx.name!;
                catalog.get("baseUrl").value = this.ctx.baseUrl!;
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

        return data;
    }
}
