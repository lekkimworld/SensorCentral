import { Alert, ALERT_TYPES, Device, Sensor } from "../clientside-types";
import { DropdownControl, Form, InitEvent, UICatalog } from "../forms-util";

export class AlertForm extends Form<Alert> {
    private parent: Device|Sensor;
    private parentIsDevice: boolean;

    constructor(parent: Device|Sensor, a?: Alert) {
        super("alert", a ? "Edit Alert" : "Create Alert", a);
        this.parent = parent;
        this.parentIsDevice = !("type" in parent);

        this.addEventListener("init", async (ev) => {
            (((ev as InitEvent).catalog).get("type") as DropdownControl).onChange((value) => {
                $(`.hideable-section`).each(function() {
                    if (this.id === value) {
                        this.classList.remove("hidden");
                    } else {
                        this.classList.add("hidden");
                    }
                });
            });
        })
    }

    body(catalog: UICatalog) {
        const options = Object.keys(ALERT_TYPES).reduce((prev, key) => {
            if (this.parentIsDevice && key.indexOf("Device") > 0) {
                prev[key] = key;
            } else if (!this.parentIsDevice && key.indexOf("Sensor") > 0) {
                prev[key] = key;
            }
            return prev;
        }, {} as { [key: string]: string });

        return `
        <p>This dialog allows you to configure an alert for 
        the ${this.parentIsDevice ? "device" : "sensor"}. An alert consists of a type, 
        notification information and details depending on the type to configure the alert.</p>
        <form id="deviceForm" novalidate>
        ${catalog.dropdown({
            name: "type",
            label: "Event Type",
            addBlank: true,
            required: true,
            fieldExplanation: "Select the type of alert",
            dropdownOptions: options,
        })}
        <div id="onDeviceTimeout" class="hideable-section hidden">
        ${catalog.numberField({
            name: "timeout",
            label: "Timeout",
            required: true,
            value: ""
        })}
        ${catalog.dropdown({
            name: "scale",
            label: "Scale",
            addBlank: true,
            dropdownOptions: {
                "minutes": "Minutes",
                "hours": "Hours",
                "days": "Days"
            }
        })}
        </div>
        <div id="onDeviceRestart" class="hideable-section hidden"><i>Not implemented</i></div>
        <div id="onDeviceMessage" class="hideable-section hidden"><i>Not implemented</i></div>
        <div id="onDeviceMessageNoSensor" class="hideable-section hidden"><i>Not implemented</i></div>
        <div id="onSensorTimeout" class="hideable-section hidden"><i>Not implemented</i></div>
        <div id="onSensorValue" class="hideable-section hidden"><i>Not implemented</i></div>
        <div id="onSensorSample" class="hideable-section hidden"><i>Not implemented</i></div>
        </form>`;
    }
}