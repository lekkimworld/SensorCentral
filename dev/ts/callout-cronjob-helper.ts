import { createContainers } from "./ui-helper";
import * as uiutils from "./ui-utils";
import { Callout, Device, Sensor } from "./clientside-types";
import { graphql } from "./fetch-util";
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
