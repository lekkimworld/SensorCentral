import flatpickr from "flatpickr";
import { graphql, post } from "../fetch-util";
import { createContainers } from "../ui-helper";
import * as uiutils from "../ui-utils";

export default async (elemRoot: JQuery<HTMLElement>, sensorId: string) => {
    const container = createContainers(elemRoot, "manual-sample", "title", "form");
    const titleElem = container.children!.title.elem;
    const formElem = container.children!.form.elem;

    const data = await graphql(`{sensor(id:"${sensorId}"){type,device{id,house{id}}}}`);
    const sensor = data.sensor;

    if (!sensor) {
        formElem.html(`<div class="alert alert-danger">Sensor not found.</div>`);
        return;
    }

    uiutils.appendTitleRow(titleElem, "Create/Edit Sample");

    const isBinary = sensor.type === "binary";
    const valueField = isBinary
        ? `<div class="form-group form-check">
               <input type="checkbox" class="form-check-input" id="sampleInput" checked>
               <label class="form-check-label" for="sampleInput">Value (on/off)</label>
               <small class="form-text text-muted">Select the sample value.</small>
           </div>`
        : `<div class="form-group">
               <label for="sampleInput">Value</label>
               <input type="number" required class="form-control" id="sampleInput" step="0.001" placeholder="Enter sample value">
               <small class="form-text text-muted">Specify the sample value (must be a number).</small>
               <div class="invalid-feedback">You must specify the sample value for the sensor. Must be a number.</div>
           </div>`;

    formElem.html(`
        <form id="manualSampleForm" novalidate>
            <div class="row">
                <div class="col-md-6">
                    ${valueField}
                    <div class="form-group">
                        <label>Sensor ID</label>
                        <input type="text" class="form-control" value="${sensorId}" disabled>
                    </div>
                    <div class="form-group">
                        <label for="datetimeInput">Date/Time</label>
                        <div id="datetimepicker">
                            <input type="text" required class="form-control" id="datetimeInput">
                        </div>
                        <small class="form-text text-muted">Specify the sample date/time.</small>
                        <div class="invalid-feedback">You must specify the date/time for the sample.</div>
                    </div>
                </div>
            </div>
            <hr>
            <button type="button" class="btn btn-primary mr-2" id="saveSample">Save</button>
            <button type="button" class="btn btn-secondary" id="backBtn">Back</button>
        </form>
    `);

    const fp = flatpickr(document.getElementById("datetimeInput")!, {
        enableTime: true,
        time_24hr: true,
        dateFormat: "d-m-Y H:i",
        defaultDate: new Date(),
    });

    document.getElementById("backBtn")?.addEventListener("click", () => history.back());

    document.getElementById("saveSample")?.addEventListener("click", async () => {
        const form = document.getElementById("manualSampleForm") as HTMLFormElement;
        if (!form.checkValidity()) {
            form.classList.add("was-validated");
            return;
        }

        let value: number;
        if (isBinary) {
            value = (document.getElementById("sampleInput") as HTMLInputElement).checked ? 1 : 0;
        } else {
            value = parseFloat((document.getElementById("sampleInput") as HTMLInputElement).value);
        }

        const selectedDate = (fp as flatpickr.Instance).selectedDates[0];
        const dt = selectedDate ? selectedDate.toISOString() : new Date().toISOString();

        await post("/api/v1/data/samples", {
            id: sensorId,
            value,
            deviceId: sensor.device.id,
            dt,
        });

        history.back();
    });
};
