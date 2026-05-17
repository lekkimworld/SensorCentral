import { graphql } from "../fetch-util";
import { createContainers } from "../ui-helper";
import * as uiutils from "../ui-utils";

type CronJobEntry = {
    id: string;
    jobType: string;
    active: boolean;
    frequencyMinutes: number;
    sensorId?: string;
    houseId?: string;
};

const JOB_TYPE_LABELS: Record<string, string> = {
    smartme_powermeter: "Smart-Me Powermeter",
};

export default async (elemRoot: JQuery<HTMLElement>, jobId: string) => {
    const container = createContainers(elemRoot, "cronjob-edit", "title", "form");
    const titleElem = container.children!.title.elem;
    const formElem = container.children!.form.elem;

    const data = await graphql(`{ cronJobs { id, jobType, active, frequencyMinutes, sensorId, houseId } }`);
    const jobs = (data.cronJobs || []) as CronJobEntry[];
    const job = jobs.find(j => j.id === jobId);

    if (!job) {
        formElem.html(`<div class="alert alert-danger">Cron job not found.</div><a href="#cronjobs" class="btn btn-secondary">Back</a>`);
        return;
    }

    uiutils.appendTitleRow(titleElem, "Edit Cron Job");

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
};
