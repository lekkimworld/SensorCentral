import { CalloutSecret } from "../clientside-types";
import { graphql } from "../fetch-util";
import { buttonClose, buttonPerformAction, Form, EVENTS, DataEvent, UICatalog, InitEvent, TextControl, buttonPerformDestructiveAction, ClickEvent } from "../forms-util";

export class SecretForm extends Form<CalloutSecret> {
    constructor(s?: CalloutSecret) {
        super("createSecret", s ? "Edit Secret" : "Create Secret", s);
        this.addEventListener("click", async e => {
            const ev = e as ClickEvent;
            const rel = ev.rel;
            if ("delete" === rel) {
                if (!confirm("Are you sure?")) return;
                await graphql(`mutation {
                    deleteCalloutSecret(data: {id: "${s?.id}"})
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
                    updateCalloutSecret(data: {
                        id: "${data.id}" 
                        name: "${data.name}"  
                        ${data.value ? `value: "${data.value}"` : ""}
                    }) {id}}`);
            } else {
                // create
                await graphql(`mutation {createCalloutSecret(data: {
                    name: "${data.name}" 
                    ${data.value ? `value: "${data.value}"` : ""}
                }){id}}`);
            }
            document.location.reload();
        })
        this.addEventListener("init", (ev: Event) => {
            const catalog = (ev as InitEvent).catalog;
            const bearerToken = catalog.get("value") as TextControl;
            if (this.ctx) {
                catalog.get("name").value = this.ctx.name!;
                catalog.get("value").value = this.ctx.value!;
            }
        })
    }

    body(catalog: UICatalog) {
        return `<form id="${this.name}Form" novalidate>
            ${catalog.textField({
                name: "name",
                label: "Name",
                placeholder: "Enter secret name",
                fieldExplanation: "Specify the name of the secret (maximum 36 characters).",
                required: true,
                validationText: "You must specify the name for the secret.",
            })}
            ${catalog.textField({
                name: "value",
                label: "Value",
                placeholder: "Enter secret value",
                fieldExplanation: "Specify the value of the secret (maximum 1024 characters).",
                required: true,
                validationText: "You must specify the value for the secret.",
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
            value: catalog.value("value"),
        };
        return data;
    }
}
