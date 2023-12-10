import { Sensor } from "../clientside-types";
import { post } from "../fetch-util";
import { buttonClose, buttonPerformAction, DataEvent, DateTimeControl, EVENTS, Form, InitEvent, NumberControl, ToggleButtonControl, UICatalog } from "../forms-util";

export class ManualSampleForm extends Form<Sensor> {
    constructor(sensor: Sensor) {
        super("sample", "Create/Edit Sample", sensor);
        this.addEventListener("data", async e => {
            const dataEvent = e as DataEvent;
            const data = dataEvent.data;

            // build post body
            let postbody = {
                id: this.ctx!.id!,
                value: typeof data.value === "boolean" && data.value === true ? 1 : data.value,
                deviceId: this.ctx!.device!.id,
                dt: (data.date as Date).toISOString(),
            };
            const body = await post(`/api/v1/data/samples`, postbody);
            this.eventTarget.dispatchEvent(new Event(EVENTS.postdata));
        })
        this.addEventListener("init", (ev: Event) => {
            // set id-field
            const catalog = (ev as InitEvent).catalog;
            catalog.get("id").value = this.ctx!.id!;
        })
    }

    body(catalog: UICatalog) {
        return `<form id="${this.name}Form" novalidate>
                ${catalog.disabledTextField({
                    label: "Sensor ID",
                    name: "id",
                    value: this.ctx!.id,
                })}
                ${
                    this.ctx!.type === "binary"
                        ? catalog.toggleButton({
                            name: "sample",
                            label: "Sample",
                            fieldExplanation: "Select the sample value",
                            on: true
                        })
                        : catalog.numberField({
                              name: "sample",
                              label: "Sample",
                              placeholder: "Enter sample value",
                              required: true,
                              step: .001,
                              validationText: "You must specify the sample value for the sensor. Must be a number.",
                              fieldExplanation: "Specify the sample value (must be a number).",
                          })
                }
                ${catalog.datetimepicker({
                    name: "datetimepicker1",
                    label: "Date/time",
                    fieldExplanation: "Specify the sample date/time.",
                    required: true,
                    validationText: "You must specify the date/time for the sample.",
                })}
            </form>`;
    }
    footer() {
        return `${buttonClose()}
            ${buttonPerformAction()}`;
    }
    
    async getData(catalog: UICatalog) {
        // build and return data
        const date = (catalog.get("datetimepicker1") as DateTimeControl).date;
        let value : number | undefined;
        if (this.ctx!.type === "binary") {
            value = (catalog.get("sample") as ToggleButtonControl).checked ? 1 : 0;
        } else {
            value = (catalog.get("sample") as NumberControl).float;
        }
        return {
            date,
            value,
        };
    }
}