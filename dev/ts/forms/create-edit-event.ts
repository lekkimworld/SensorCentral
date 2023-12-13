import { Endpoint, OnSensorSampleEvent, Sensor } from "../clientside-types";
import { graphql } from "../fetch-util";
import { buttonClose, buttonPerformAction, Form, EVENTS, DataEvent, UICatalog, InitEvent, buttonPerformDestructiveAction, DropdownControl, ClickEvent } from "../forms-util";

type RequestedEndpointType = Readonly<Pick<Endpoint, "id" | "name">>;

export class OnSensorSampleEventForm extends Form<OnSensorSampleEvent> {
    endpoints : Array<RequestedEndpointType>;
    sensor: Sensor;

    constructor(sensor: Sensor, ev?: OnSensorSampleEvent) {
        super("createEvent", ev ? "Edit Event" : "Create Event", ev);
        this.sensor = sensor;

        this.addEventListener("click", async (e) => {
            const ev = e as ClickEvent;
            const rel = ev.rel;
            if ("delete" === rel) {
                if (!confirm("Are you sure?")) return;
                await graphql(`mutation {
                    deleteEvent(data: {id: "${this.ctx!.id}"})
                }`);
                document.location.reload();
            }
        });

        this.addEventListener(EVENTS.data, async (e) => {
            const dataEvent = e as DataEvent;
            const data = dataEvent.data;
            const id = data.id;
            let bodyTemplate = "";
            if (data.bodyTemplate && (data.bodyTemplate as string).length) {
                bodyTemplate = `bodyTemplate: "${(data.bodyTemplate as string).replace(/"/g, "\\\"")}"`;
            }
            if (id) {
                // update
                await graphql(
                    `mutation {updateEvent(data: {
                        id: "${data.id}"
                        method: ${data.method}
                        path: "${data.path}"
                        ${bodyTemplate}
                    }){id}}`
                );
            } else {
                // create
                await graphql(
                    `mutation {createEvent(data: {
                        sensorId: "${this.sensor.id}"
                        endpointId: "${data.endpointId}"
                        method: ${data.method}
                        path: "${data.path}"
                        ${bodyTemplate}
                    }){id}}`
                );
            }
            document.location.reload();
        });

        this.addEventListener("init", async (ev: Event) => {
            const catalog = (ev as InitEvent).catalog;
            if (this.ctx) {
                catalog.get("endpoint").value = this.ctx.endpoint!.id;
                catalog.get("method").value = this.ctx.method!;
                catalog.get("path").value = this.ctx.path!;
                catalog.get("bodyTemplate").value = this.ctx.bodyTemplate || "";
            }
        });
    }

    async loadData(): Promise<void> {
        // get endpoints for the user
        return new Promise((resolve) => {
            graphql(
                    `
                        query {
                            endpoints {
                                id
                                name
                            }
                        }
                    `
            ).then(data => {
                this.endpoints = data.endpoints;
                resolve();
            });
        })
        
    }

    body(catalog: UICatalog) {
        return `<form id="${this.name}Form" novalidate>
            ${catalog.dropdown({
                name: "endpoint",
                label: "Endpoint",
                addBlank: true,
                required: true,
                dropdownOptions: this.endpoints.reduce((prev, endpoint) => {
                    prev[endpoint.id!] = endpoint.name;
                    return prev;
                }, {}),
                fieldExplanation: "Select the endpoint to use for the request",
            })}
            ${catalog.dropdown({
                name: "method",
                label: "Method",
                addBlank: false,
                required: true,
                dropdownOptions: {"POST": "POST", "GET": "GET"},
                fieldExplanation: "Select the method to use for the request",
            })}
            ${catalog.textField({
                name: "path",
                label: "Path",
                placeholder: "Enter path",
                fieldExplanation:
                    "Specify the path to make the request to using substituting patterns where applicable (pattern is &&key%%, maximum 1024 characters).",
            })}
            ${catalog.textArea({
                name: "bodyTemplate",
                label: "Body Template",
                placeholder: "Specify the body template",
                fieldExplanation:
                    "Specify the body template to use (if any) using substituting patterns where applicable (pattern us &&key%%, maximum 1024 characters)."
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
            id: this.ctx?.id,
            path: catalog.value("path"),
            bodyTemplate: catalog.value("bodyTemplate"),
            endpointId: catalog.value("endpoint"),
            method: catalog.value("method")
        };
    }
}
