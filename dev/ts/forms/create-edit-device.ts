import { Device, House } from "../clientside-types";
import { graphql } from "../fetch-util";
import { buttonClose, buttonPerformAction, DataEvent, Form, FormData, InitEvent, NumberControl, ToggleButtonControl, UICatalog } from "../forms-util";

export class DeviceForm extends Form<Device> {
    private readonly house!: House;
    constructor(house: House, device?: Device) {
        super("device", device ? "Edit Device" : "Create Device", device);
        this.house = house;
        this.addEventListener("init", (ev: Event) => {
            const catalog = (ev as InitEvent).catalog;
            (catalog.get("active") as ToggleButtonControl).checked = !this.ctx || (this.ctx && this.ctx.active) ? true : false;

            const timeoutToggle = catalog.get("enableTimeout") as ToggleButtonControl;
            timeoutToggle.onChange(() => {
                const section = document.getElementById("timeout-section")!;
                if (timeoutToggle.checked) {
                    section.classList.remove("hidden");
                } else {
                    section.classList.add("hidden");
                }
            });
            if (this.ctx && this.ctx.timeoutSeconds) {
                timeoutToggle.checked = true;
                catalog.get("timeoutSeconds").value = `${this.ctx.timeoutSeconds}`;
                document.getElementById("timeout-section")!.classList.remove("hidden");
            }
        })
        this.addEventListener("data", async e => {
            const dataEvent = e as DataEvent;
            const data = dataEvent.data;
            const timeoutValue = data.timeoutSeconds === "null" ? "null" : data.timeoutSeconds;
            if (this.ctx) {
                // update
                await graphql(
                    `mutation {updateDevice(data: {id: "${data.id}", name: "${data.name}", active: ${data.active}, timeoutSeconds: ${timeoutValue}}){id}}`
                )
            } else {
                // create
                await graphql(
                    `mutation {createDevice(data: {houseId: "${this.house.id}", id: "${data.id}", name: "${data.name}", active: ${data.active}, timeoutSeconds: ${timeoutValue}}){id}}`
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
            ${catalog.toggleButton({
                name: "enableTimeout",
                label: "Enable Timeout",
                fieldExplanation: "Enable watchdog monitoring for this device. A timeout event fires if no data is received within the specified period.",
            })}
            <div id="timeout-section" class="hideable-section hidden">
            ${catalog.numberField({
                name: "timeoutSeconds",
                label: "Timeout (seconds)",
                value: "600",
                required: true,
                fieldExplanation: "Number of seconds of inactivity before a timeout event is raised.",
            })}
            </div>
        </form>`;
    }
    footer() {
        return `${buttonClose()}
            ${buttonPerformAction()}`
    }
    
    async getData(catalog: UICatalog): Promise<FormData> {
        const enableTimeout = (catalog.get("enableTimeout") as ToggleButtonControl).checked;
        return {
            "id": this.ctx ? this.ctx!.id : catalog.value("id"),
            "name": catalog.value("name"),
            "active": (catalog.get("active") as ToggleButtonControl).checked,
            "timeoutSeconds": enableTimeout ? (catalog.get("timeoutSeconds") as NumberControl).int.toString() : "null",
        }
    }
}