import { graphql } from "../fetch-util";
import { createContainers } from "../ui-helper";
import * as uiutils from "../ui-utils";
import { Cron } from "croner";
import { formatDMYTime } from "../date-utils";

type CronJobEntry = {
    id: string;
    jobType: string;
    active: boolean;
    frequencyMinutes: number;
    calloutId?: string;
    cronExpression?: string;
    sensorId?: string;
    deviceId?: string;
    houseId?: string;
};

type CalloutLookup = { id: string; name: string };

const JOB_TYPE_LABELS: Record<string, string> = {
    SMARTME_POWERMETER: "Smart-Me Powermeter",
    CALLOUT: "Scheduled Callout",
};

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

export default async (elemRoot: JQuery<HTMLElement>, jobId: string) => {
    const container = createContainers(elemRoot, "cronjob-edit", "title", "form");
    const titleElem = container.children!.title.elem;
    const formElem = container.children!.form.elem;

    const data = await graphql(`{
        cronJobs { id, jobType, active, frequencyMinutes, calloutId, cronExpression, sensorId, deviceId, houseId }
        callouts { id, name }
    }`);
    const jobs = (data.cronJobs || []) as CronJobEntry[];
    const callouts = (data.callouts || []) as CalloutLookup[];
    const job = jobs.find(j => j.id === jobId);

    if (!job) {
        formElem.html(`<div class="alert alert-danger">Cron job not found.</div><a href="#cronjobs" class="btn btn-secondary">Back</a>`);
        return;
    }

    uiutils.appendTitleRow(titleElem, "Edit Cron Job");

    if (job.jobType === "CALLOUT") {
        renderCalloutForm(formElem, job, callouts);
    } else {
        renderSmartmeForm(formElem, job);
    }
};

const renderCalloutForm = (formElem: JQuery<HTMLElement>, job: CronJobEntry, callouts: CalloutLookup[]) => {
    const calloutName = callouts.find(c => c.id === job.calloutId)?.name || job.calloutId || "-";
    const targetLabel = job.deviceId ? "Device" : "Sensor";
    const targetId = job.deviceId || job.sensorId || "-";
    const presetOptions = PRESETS.map(p => `<option value="${p.value}">${p.label}</option>`).join("");

    formElem.html(`
        <form id="cronjobEditForm" novalidate>
            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label>Job Type</label>
                        <input type="text" class="form-control" disabled value="${JOB_TYPE_LABELS[job.jobType]}">
                    </div>
                    <div class="form-group">
                        <label>Callout</label>
                        <input type="text" class="form-control" disabled value="${calloutName}">
                    </div>
                    <div class="form-group">
                        <label>${targetLabel} ID</label>
                        <input type="text" class="form-control" disabled value="${targetId}">
                    </div>
                    <div class="form-group">
                        <label for="activeInput">Active</label>
                        <select class="form-control" id="activeInput">
                            <option value="true" ${job.active ? "selected" : ""}>Yes</option>
                            <option value="false" ${!job.active ? "selected" : ""}>No</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="presetInput">Schedule Preset</label>
                        <select class="form-control" id="presetInput">
                            ${presetOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="cronExpressionInput">Cron Expression</label>
                        <input type="text" required class="form-control" id="cronExpressionInput" value="${job.cronExpression || "*/5 * * * *"}">
                        <small class="form-text text-muted" id="cronDescription"></small>
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
            <button type="button" class="btn btn-danger mr-2" id="deleteCronJob">Delete</button>
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
            const c = new Cron(expr);
            const next = c.nextRun();
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
        if (!validateCron()) return;

        const active = (document.getElementById("activeInput") as HTMLSelectElement).value === "true";
        const cronExpression = cronInput.value.trim();

        await graphql(`mutation {
            updateCronJob(data: {
                id: "${job.id}"
                active: ${active}
                cronExpression: "${cronExpression}"
            }) { id }
        }`);
        document.location.hash = "#cronjobs";
    });

    document.getElementById("deleteCronJob")?.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to delete this cron job?")) return;
        await graphql(`mutation { deleteCronJob(id: "${job.id}") }`);
        document.location.hash = "#cronjobs";
    });
};

const renderSmartmeForm = (formElem: JQuery<HTMLElement>, job: CronJobEntry) => {
    formElem.html(`
        <form id="cronjobEditForm" novalidate>
            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label>Job Type</label>
                        <input type="text" class="form-control" disabled value="${JOB_TYPE_LABELS[job.jobType] || job.jobType}">
                    </div>
                    <div class="form-group">
                        <label>Sensor ID</label>
                        <input type="text" class="form-control" disabled value="${job.sensorId || "-"}">
                    </div>
                    <div class="form-group">
                        <label for="activeInput">Active</label>
                        <select class="form-control" id="activeInput">
                            <option value="true" ${job.active ? "selected" : ""}>Yes</option>
                            <option value="false" ${!job.active ? "selected" : ""}>No</option>
                        </select>
                        <small class="form-text text-muted">Whether the cron job is actively polling</small>
                    </div>
                    <div class="form-group">
                        <label for="frequencyMinutesInput">Frequency</label>
                        <select class="form-control" id="frequencyMinutesInput" required>
                            ${[1, 2, 5, 10, 15, 30, 60].map(m =>
                                `<option value="${m}" ${job.frequencyMinutes === m ? "selected" : ""}>Every ${m} minute${m > 1 ? "s" : ""}</option>`
                            ).join("")}
                        </select>
                        <small class="form-text text-muted">How often to poll for new readings</small>
                    </div>
                </div>
            </div>
            <hr>
            <button type="button" class="btn btn-primary mr-2" id="saveCronJob">Save</button>
            <button type="button" class="btn btn-danger mr-2" id="deleteCronJob">Delete</button>
            <a href="#cronjobs" class="btn btn-secondary">Back</a>
        </form>
    `);

    document.getElementById("saveCronJob")?.addEventListener("click", async () => {
        const active = (document.getElementById("activeInput") as HTMLSelectElement).value === "true";
        const frequencyMinutes = parseInt((document.getElementById("frequencyMinutesInput") as HTMLSelectElement).value, 10);

        await graphql(`mutation {
            updateCronJob(data: {
                id: "${job.id}"
                active: ${active}
                frequencyMinutes: ${frequencyMinutes}
            }) { id }
        }`);
        document.location.hash = "#cronjobs";
    });

    document.getElementById("deleteCronJob")?.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to delete this cron job?")) return;
        await graphql(`mutation { deleteCronJob(id: "${job.id}") }`);
        document.location.hash = "#cronjobs";
    });
};
