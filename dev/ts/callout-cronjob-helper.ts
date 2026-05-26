import { createContainers } from "./ui-helper";
import * as uiutils from "./ui-utils";
import { Callout, Device, Sensor } from "./clientside-types";
import { graphql } from "./fetch-util";
import { DeleteForm } from "./forms/delete";
import { Cron } from "croner";
import { formatDMYTime } from "./date-utils";

type CronJobEntry = {
    id: string;
    jobType: string;
    active: boolean;
    calloutId?: string;
    cronExpression?: string;
    sensorId?: string;
    deviceId?: string;
};

type CalloutLookup = Required<Pick<Callout, "id" | "name">>;

const describeCron = (expr: string): string => {
    try {
        const job = new Cron(expr);
        const next = job.nextRun();
        return next ? `${expr} (next: ${formatDMYTime(next)})` : expr;
    } catch {
        return expr;
    }
};

export const addCalloutCronJobSection = (
    parentElem: JQuery<HTMLElement>,
    target: Device | Sensor,
    isDevice: boolean
) => {
    const container = createContainers(parentElem, "callout-cronjobs", "title", "content");
    const titleElem = container.children!.title.elem;
    const contentElem = container.children!.content.elem;

    uiutils.appendTitleRow(titleElem, "Scheduled Callouts", [
        {
            rel: "create",
            icon: "plus",
            click: async () => {
                const targetParam = isDevice ? `deviceId=${target.id}` : `sensorId=${target.id}`;
                document.location.hash = `cronjobs/create-callout?${targetParam}`;
            },
        },
        {
            rel: "refresh",
            icon: "refresh",
            click: async () => {
                await loadAndRender();
            },
        },
    ]);

    const loadAndRender = async () => {
        contentElem.html("");
        const data = await graphql(`{
            cronJobs { id, jobType, active, calloutId, cronExpression, sensorId, deviceId }
            callouts { id, name }
        }`);
        const allJobs = (data.cronJobs || []) as CronJobEntry[];
        const callouts = (data.callouts || []) as CalloutLookup[];

        const jobs = allJobs.filter(j =>
            j.jobType === "CALLOUT" && (
                (isDevice && j.deviceId === target.id) ||
                (!isDevice && j.sensorId === target.id)
            )
        );

        if (!jobs.length) {
            contentElem.html("No scheduled callouts.");
            return;
        }

        uiutils.appendDataTable(contentElem, {
            actions: [
                {
                    rel: "trash",
                    icon: "trash",
                    click: async (actionCtx) => {
                        const calloutName = callouts.find(c => c.id === actionCtx.data.calloutId)?.name || "";
                        new DeleteForm({
                            id: actionCtx.id,
                            name: calloutName,
                            title: "Delete Scheduled Callout?",
                            message: "This will stop the scheduled execution. The callout itself will not be deleted.",
                        }).addEventListener("data", async () => {
                            await graphql(`mutation { deleteCronJob(id: "${actionCtx.id}") }`);
                            await loadAndRender();
                        });
                    },
                },
            ],
            headers: ["CALLOUT", "SCHEDULE", "ACTIVE"],
            classes: ["", "", ""],
            rows: jobs.map((j) => {
                const calloutName = callouts.find(c => c.id === j.calloutId)?.name || j.calloutId || "";
                return {
                    id: j.id,
                    data: j,
                    columns: [
                        calloutName,
                        j.cronExpression ? describeCron(j.cronExpression) : "—",
                        j.active ? "Yes" : "No",
                    ],
                    click: function () {
                        document.location.hash = `cronjobs/edit/${j.id}`;
                    },
                };
            }),
        });
    };

    loadAndRender();
};
