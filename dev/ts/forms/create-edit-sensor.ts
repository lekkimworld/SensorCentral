import { Device, Sensor } from "../clientside-types";
import { graphql } from "../fetch-util";
import { buttonClose, buttonPerformAction, DataEvent, DropdownControl, Form, InitEvent, UICatalog } from "../forms-util";

export class SensorForm extends Form<Sensor> {
    private readonly device!: Device;

    constructor(device: Device, sensor?: Sensor) {
        super("sensor", sensor ? "Edit Sensor" : "Create Sensor", sensor);
        this.device = device;
        this.addEventListener("data", async e => {
            const dataEvent = e as DataEvent;
            const data = dataEvent.data;
            if (this.ctx) {
                // update
                await graphql(
                    `mutation {updateSensor(data: {id: "${data.id}", name: "${data.name}", label: "${data.label}", type: "${data.type}", icon: "${data.icon}", scaleFactor: ${data.scaleFactor}}){id}}`
                );
            } else {
                // create
                await graphql(
                    `mutation {createSensor(data: {deviceId: "${this.device.id}", id: "${data.id}", name: "${data.name}", label: "${data.label}", type: "${data.type}", icon: "${data.icon}", scaleFactor: ${data.scaleFactor}}){id}}`
                );
            }
            document.location.reload();
        })
        this.addEventListener("init", (ev: Event) => {
            // get catalog
            const catalog = (ev as InitEvent).catalog;

            // get type and set onchange event listener
            const sensorType = catalog.get("type") as DropdownControl;
            sensorType.onChange((value) => {
                $(`.hideable-section`).each(function () {
                    if (this.id === value) {
                        this.classList.remove("hidden");
                    } else {
                        this.classList.add("hidden");
                    }
                });
            });

            // exit if a new sensor is being created
            if (!this.ctx) return;
            sensorType.value = this.ctx!.type!;
            catalog.get("id").value = this.ctx!.id!;
            catalog.get("name").value = this.ctx!.name!;
            catalog.get("label").value = this.ctx!.label!;
            catalog.get("icon").value = this.ctx!.icon!;
            catalog.get("scalefactor").value = `${this.ctx!.scaleFactor!}`;
        })
    }

    body(catalog: UICatalog) {
        return `<form id="${this.name}Form" novalidate>
                    ${
                        this.ctx
                            ? catalog.disabledTextField({ name: "id", label: "ID" })
                            : catalog.textField({
                                  name: "id",
                                  label: "ID",
                                  fieldExplanation: "Specify the ID of the sensor (maximum 36 characters).",
                                  required: true,
                                  validationText: "You must specify the ID for the sensor. Must be unique.",
                              })
                    }
                    ${catalog.textField({
                        name: "name",
                        label: "Name",
                        fieldExplanation: "Specify the name of the sensor (maximum 128 characters).",
                        required: true,
                        validationText: "You must specify the name for the sensor. Must be unique.",
                    })}
                    ${catalog.dropdown({
                        name: "type",
                        label: "Type",
                        fieldExplanation: "Specify the type of the sensor.",
                        dropdownOptions: {
                            gauge: "Gauge (value goes up/down e.g. temperature)",
                            counter: "Counter (value only increases)",
                            delta: "Delta (sensor sends change only, scale factor may apply)",
                            binary: "Binary (on/off)",
                        },
                        addBlank: false,
                        required: true,
                        validationText: "You must specify the type of the sensor.",
                    })}
                    ${catalog.dropdown({
                        name: "icon",
                        label: "Icon",
                        fieldExplanation: "Specify the icon for the sensor.",
                        dropdownOptions: {
                            "battery-4": "Power",
                            "thermometer-empty": "Temperature",
                            tint: "Humidity",
                            tachometer: "Tachometer",
                            "toggle-off": "On/off",
                        },
                        addBlank: false,
                        required: true,
                        validationText: "You must specify the icon for the sensor.",
                    })}
                    <div id="delta" class="hideable-section hidden">
                    ${catalog.dropdown({
                        name: "scalefactor",
                        label: "Scale Factor",
                        fieldExplanation: "Specify the scale factor for the sensor.",
                        dropdownOptions: {
                            1: "1",
                            0.001: "1/1000",
                            0.002: "1/500",
                            0.01: "1/100",
                        },
                        addBlank: false,
                        required: true,
                        validationText: "You must specify the scale factor for the sensor.",
                    })}
                    </div>
                    ${catalog.textField({
                        name: "label",
                        label: "Label",
                        fieldExplanation: "Specify the label of the sensor (maximum 128 characters).",
                        required: false,
                    })}
                </form>`;
    }

    footer() {
        return `${buttonPerformAction("Yes")}
                ${buttonClose("No")}`;
    }
    
    async getData(catalog: UICatalog): Promise<Record<string, string>> {
        return {
            id: catalog.value("id"),
            name: catalog.value("name"),
            label: catalog.value("label"),
            type: catalog.value("type"),
            icon: catalog.value("icon"),
            scaleFactor: catalog.value("scalefactor"),
        };
    }
}