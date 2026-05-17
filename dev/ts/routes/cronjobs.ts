import { graphql } from "../fetch-util";
import { createContainers } from "../ui-helper";
import * as uiutils from "../ui-utils";

type CronJobEntry = {
    id: string;
    jobType: string;
    active: boolean;
    frequencyMinutes: number;
    calloutId?: string;
    sensorId?: string;
    houseId?: string;
};

const JOB_TYPE_LABELS: Record<string, string> = {
    smartme_powermeter: "Smart-Me Powermeter",
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
    const data = await graphql(`{ cronJobs { id, jobType, active, frequencyMinutes, sensorId, houseId } }`);
    const jobs = (data.cronJobs || []) as CronJobEntry[];

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
                    if (!confirm("Delete this cron job and its associated callout infrastructure?")) return;
                    await graphql(`mutation { deleteCronJob(id: "${actionCtx.id}") }`);
                    document.location.reload();
                },
            },
        ],
        headers: ["TYPE", "SENSOR", "FREQUENCY", "ACTIVE"],
        classes: ["", "", "", ""],
        rows: jobs.map((j) => ({
            id: j.id,
            data: j,
            click: function () {
                document.location.hash = `#cronjobs/edit/${j.id}`;
            },
            columns: [
                JOB_TYPE_LABELS[j.jobType] || j.jobType,
                j.sensorId || "-",
                `${j.frequencyMinutes} min`,
                j.active ? '<span class="text-success">Yes</span>' : '<span class="text-muted">No</span>',
            ],
        })),
    });
};
