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

const describeSchedule = (job: CronJobEntry): string => {
    if (job.cronExpression) {
        try {
            const c = new Cron(job.cronExpression);
            const next = c.nextRun();
            return next ? `${job.cronExpression} (next: ${formatDMYTime(next)})` : job.cronExpression;
        } catch {
            return job.cronExpression;
        }
    }
    return `${job.frequencyMinutes} min`;
};

export default async (elemRoot: JQuery<HTMLElement>) => {
    elemRoot.html("");

    const container = createContainers(elemRoot, "cronjobs", "title", "content");

    uiutils.appendTitleRow(container.children!.title.elem, "Cron Jobs", [
        {
            rel: "create-cronjob",
            icon: "plus",
            click: async function () {
                document.location.hash = "#cronjobs/create";
            },
        },
        {
            rel: "refresh-cronjobs",
            icon: "refresh",
            click: async function () {
                await loadJobs(container.children!.content.elem);
            },
        },
    ]);

    await loadJobs(container.children!.content.elem);
};

const loadJobs = async (contentElem: JQuery<HTMLElement>) => {
    contentElem.html("");
    const data = await graphql(`{
        cronJobs { id, jobType, active, frequencyMinutes, calloutId, cronExpression, sensorId, deviceId, houseId }
        callouts { id, name }
    }`);
    const jobs = (data.cronJobs || []) as CronJobEntry[];
    const callouts = (data.callouts || []) as CalloutLookup[];

    if (!jobs.length) {
        contentElem.html("No cron jobs configured. Click + to create one.");
        return;
    }

    uiutils.appendDataTable(contentElem, {
        actions: [
            {
                rel: "delete-cronjob",
                icon: "remove",
                click: async (actionCtx: any) => {
                    if (!confirm("Delete this cron job?")) return;
                    await graphql(`mutation { deleteCronJob(id: "${actionCtx.id}") }`);
                    await loadJobs(contentElem);
                },
            },
        ],
        headers: ["TYPE", "CALLOUT", "TARGET", "SCHEDULE", "ACTIVE"],
        classes: ["", "", "d-none d-md-table-cell", "", ""],
        rows: jobs.map((j) => {
            const calloutName = j.calloutId
                ? (callouts.find(c => c.id === j.calloutId)?.name || j.calloutId.substring(0, 8))
                : "-";
            const target = j.sensorId || j.deviceId || "-";
            return {
                id: j.id,
                data: j,
                click: function () {
                    document.location.hash = `#cronjobs/edit/${j.id}`;
                },
                columns: [
                    JOB_TYPE_LABELS[j.jobType] || j.jobType,
                    calloutName,
                    target.length > 12 ? target.substring(0, 12) + "…" : target,
                    describeSchedule(j),
                    j.active ? '<span class="text-success">Yes</span>' : '<span class="text-muted">No</span>',
                ],
            };
        }),
    });
};
