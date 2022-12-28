import { House } from "../clientside-types";
import { graphql } from "../fetch-util";
import { buttonClose, buttonPerformAction, Form, EVENTS, DataEvent, UICatalog, InitEvent } from "../forms-util";

export class HouseForm extends Form<House> {
    constructor(h?: House) {
        super("createHouse", h ? "Edit House" : "Create House", h);
        this.addEventListener(EVENTS.data, async e => {
            const dataEvent = e as DataEvent;
            const data = dataEvent.data;
            const id = data.id;
            if (id) {
                // update
                await graphql(`mutation {updateHouse(data: {id: "${data.id}", name: "${data.name}"}){id}}`);
            } else {
                // create
                await graphql(`mutation {createHouse(data: {name: "${data.name}"}){id}}`);
            }
            document.location.reload();
        })
        this.addEventListener("init", (ev: Event) => {
            const catalog = (ev as InitEvent).catalog;
            if (this.ctx) {
                catalog.get("name").value = this.ctx.name!;
            }
        })
    }

    body(catalog: UICatalog) {
        return `<form id="${this.name}Form" novalidate>
            ${catalog.textField({
                name: "name",
                label: "Name",
                placeholder: "Enter house name",
                fieldExplanation: "Specify the name of the house (maximum 128 characters).",
                required: true,
                validationText: "You must specify the name for the house. Must be unique.",
            })}
        </form>`;
    }
    footer() {
        return `
            ${buttonClose()}
            ${buttonPerformAction()}
        `;
    }
    async getData(catalog: UICatalog) {
        return {
            id: this.ctx?.id,
            name: catalog.value("name"),
        };
    }
}
