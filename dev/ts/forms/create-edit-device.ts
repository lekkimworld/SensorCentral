import { Device, House } from "../clientside-types";
import { graphql } from "../fetch-util";
import { buttonClose, buttonPerformAction, DataEvent, Form, FormData, InitEvent, ToggleButtonControl, UICatalog } from "../forms-util";

export class DeviceForm extends Form<Device> {
    private readonly house!: House;
    constructor(house: House, device?: Device) {
        super("device", device ? "Edit Device" : "Create Device", device);
        this.house = house;
        this.addEventListener("init", (ev: Event) => {
            const catalog = (ev as InitEvent).catalog;
            (catalog.get("active") as ToggleButtonControl).checked = !this.ctx || (this.ctx && this.ctx.active) ? true : false;
        })
        this.addEventListener("data", async e => {
            const dataEvent = e as DataEvent;
            const data = dataEvent.data;
            if (this.ctx) {
                // update
                await graphql(
                    `mutation {updateDevice(data: {id: "${data.id}", name: "${data.name}", active: ${data.active}}){id}}`
                )
            } else {
                // create
                await graphql(
                    `mutation {createDevice(data: {houseId: "${this.house.id}", id: "${data.id}", name: "${data.name}", active: ${data.active}}){id}}`
                )
            }
            document.location.reload();
        })
    }
    body(catalog: UICatalog) {
        return `<form id="deviceForm" novalidate>
            ${
                this.ctx
                    ? catalog.disabledTextField({
                          name: "id",
                          label: "ID",
                          value: this.ctx.id,
                      })
                    : catalog.textField({
                          name: "id",
                          label: "ID",
                          placeholder: "Enter device ID",
                          fieldExplanation: "Specify the ID of the device (maximum 36 characters).",
                          required: true,
                          validationText: "You must specify the ID for the device. Must be unique.",
                      })
            }
            ${catalog.textField({
                name: "name",
                label: "Name",
                placeholder: "Enter device name",
                fieldExplanation: "Specify the name of the device (maximum 128 characters).",
                required: true,
                validationText: "You must specify the name for the device. Must be unique.",
                value: this.ctx?.name,
            })}
            ${catalog.toggleButton({
                name: "active",
                label: "Active",
                fieldExplanation:
                    "Making a device inactive sorts it at the bottom and disables any alerts for the device.",
            })}
        </form>`;
    }
    footer() {
        return `${buttonClose()}
            ${buttonPerformAction()}`
    }
    
    async getData(catalog: UICatalog): Promise<FormData> {
        return {
            "id": this.ctx ? this.ctx!.id : catalog.value("id"),
            "name": catalog.value("name"),
            "active": (catalog.get("active") as ToggleButtonControl).checked
        }
    }
}