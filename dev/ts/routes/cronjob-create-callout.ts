import { graphql } from "../fetch-util";
import { createContainers } from "../ui-helper";
import * as uiutils from "../ui-utils";
import { Cron } from "croner";
import { formatDMYTime } from "../date-utils";

type CalloutOption = { id: string; name: string };

const PRESETS: Array<{ label: string; value: string }> = [
    { label: "Every 5 minutes", value: "*/5 * * * *" },
    { label: "Every 15 minutes", value: "*/15 * * * *" },
    { label: "Every 30 minutes", value: "*/30 * * * *" },
    { label: "Hourly", value: "0 * * * *" },
    { label: "Daily at 08:00", value: "0 8 * * *" },
    { label: "Daily at midnight", value: "0 0 * * *" },
    { label: "Weekly Monday 09:00", value: "0 9 * * 1" },
    { label: "Custom...", value: "" },
];

export default async (elemRoot: JQuery<HTMLElement>, params: URLSearchParams) => {
    const container = createContainers(elemRoot, "cronjob-create-callout", "title", "form");
    const titleElem = container.children!.title.elem;
    const formElem = container.children!.form.elem;

    const prefillSensorId = params.get("sensorId") || "";
    const prefillDeviceId = params.get("deviceId") || "";

    const data = await graphql(`{ callouts { id, name } }`);
    const callouts: CalloutOption[] = data.callouts || [];

    uiutils.appendTitleRow(titleElem, "Create Scheduled Callout");

    const calloutOptions = callouts.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
    const presetOptions = PRESETS.map(p => `<option value="${p.value}">${p.label}</option>`).join("");
    const targetType = prefillDeviceId ? "device" : "sensor";

    formElem.html(`
        <form id="calloutCronjobForm" novalidate>
            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="calloutIdInput">Callout</label>
                        <select class="form-control" id="calloutIdInput" required>
                            <option value="">— select a callout —</option>
                            ${calloutOptions}
                        </select>
                        <small class="form-text text-muted">The callout to execute on schedule</small>
                    </div>
                    <div class="form-group">
                        <label for="targetTypeInput">Target Type</label>
                        <select class="form-control" id="targetTypeInput" required>
                            <option value="sensor" ${targetType === "sensor" ? "selected" : ""}>Sensor</option>
                            <option value="device" ${targetType === "device" ? "selected" : ""}>Device</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="targetIdInput">Target ID</label>
                        <input type="text" required class="form-control" id="targetIdInput" value="${prefillSensorId || prefillDeviceId}" placeholder="ID of the sensor or device">
                        <small class="form-text text-muted">The sensor or device that will be passed as context to the callout template</small>
                    </div>
                    <div class="form-group">
                        <label for="presetInput">Schedule Preset</label>
                        <select class="form-control" id="presetInput">
                            ${presetOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="cronExpressionInput">Cron Expression</label>
                        <input type="text" required class="form-control" id="cronExpressionInput" value="*/5 * * * *" placeholder="*/5 * * * *">
                        <small class="form-text text-muted" id="cronDescription">Runs every 5 minutes</small>
                        <div class="invalid-feedback" id="cronError"></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <h5>Cron Expression Help</h5>
                    <p>Format: <code>minute hour day-of-month month day-of-week</code></p>
                    <table class="table table-sm table-bordered">
                        <thead><tr><th>Field</th><th>Range</th></tr></thead>
                        <tbody>
                            <tr><td>Minute</td><td>0-59</td></tr>
                            <tr><td>Hour</td><td>0-23</td></tr>
                            <tr><td>Day of month</td><td>1-31</td></tr>
                            <tr><td>Month</td><td>1-12</td></tr>
                            <tr><td>Day of week</td><td>0-7 (0 and 7 = Sunday)</td></tr>
                        </tbody>
                    </table>
                    <p><code>*</code> = any, <code>*/N</code> = every N, <code>N-M</code> = range, <code>N,M</code> = list</p>
                </div>
            </div>
            <hr>
            <button type="button" class="btn btn-primary mr-2" id="saveCronJob">Save</button>
            <a href="#cronjobs" class="btn btn-secondary">Back</a>
        </form>
    `);

    const cronInput = document.getElementById("cronExpressionInput") as HTMLInputElement;
    const cronDesc = document.getElementById("cronDescription") as HTMLElement;
    const cronError = document.getElementById("cronError") as HTMLElement;
    const presetSelect = document.getElementById("presetInput") as HTMLSelectElement;

    const validateCron = () => {
        const expr = cronInput.value.trim();
        try {
            const job = new Cron(expr);
            const next = job.nextRun();
            cronDesc.textContent = next ? `Next run: ${formatDMYTime(next)}` : "Valid expression";
            cronDesc.classList.remove("text-danger");
            cronDesc.classList.add("text-muted");
            cronInput.setCustomValidity("");
            cronError.textContent = "";
            return true;
        } catch (err: any) {
            cronDesc.textContent = err.message || "Invalid expression";
            cronDesc.classList.remove("text-muted");
            cronDesc.classList.add("text-danger");
            cronInput.setCustomValidity("Invalid cron expression");
            cronError.textContent = err.message;
            return false;
        }
    };

    presetSelect.addEventListener("change", () => {
        const value = presetSelect.value;
        if (value) {
            cronInput.value = value;
            validateCron();
        }
        cronInput.focus();
    });

    cronInput.addEventListener("input", validateCron);
    validateCron();

    document.getElementById("saveCronJob")?.addEventListener("click", async () => {
        const form = document.getElementById("calloutCronjobForm") as HTMLFormElement;
        if (!validateCron() || !form.checkValidity()) {
            form.classList.add("was-validated");
            return;
        }

        const calloutId = (document.getElementById("calloutIdInput") as HTMLSelectElement).value;
        const targetTypeVal = (document.getElementById("targetTypeInput") as HTMLSelectElement).value;
        const targetId = (document.getElementById("targetIdInput") as HTMLInputElement).value.trim();
        const cronExpression = cronInput.value.trim();

        const targetField = targetTypeVal === "device"
            ? `deviceId: "${targetId}"`
            : `sensorId: "${targetId}"`;

        await graphql(`mutation {
            createCalloutCronJob(data: {
                calloutId: "${calloutId}"
                cronExpression: "${cronExpression}"
                ${targetField}
            }) { id }
        }`);
        document.location.hash = "#cronjobs";
    });
};
