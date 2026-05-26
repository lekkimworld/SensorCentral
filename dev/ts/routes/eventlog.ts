import { graphql } from "../fetch-util";
import { TestResultForm } from "../forms/test-result";
import { createContainers } from "../ui-helper";
import * as uiutils from "../ui-utils";
import { formatDMYTime } from "../date-utils";

type EventLogEntry = {
    timestamp: string;
    triggerType: string;
    targetId: string;
    targetName: string;
    targetPath?: string;
    actionType: string;
    actionDetail: string;
    success: boolean;
    error?: string;
    request?: string;
    response?: string;
};

export default async (elemRoot: JQuery<HTMLElement>) => {
    const container = createContainers(elemRoot, "eventlog-full", "title", "content");

    uiutils.appendTitleRow(container.children!.title.elem, "Event Activity Log", [
        {
            rel: "refresh-eventlog",
            icon: "refresh",
            click: async function () {
                await loadLog(container.children!.content.elem);
            },
        },
    ]);

    await loadLog(container.children!.content.elem);
};

const loadLog = async (contentElem: JQuery<HTMLElement>) => {
    contentElem.html("");
    const data = await graphql(`{ eventLog { timestamp, triggerType, targetId, targetName, targetPath, actionType, actionDetail, success, error, request, response } }`);
    const entries = (data.eventLog || []) as EventLogEntry[];

    if (!entries.length) {
        contentElem.html("No event activity recorded yet.");
        return;
    }

    uiutils.appendDataTable(contentElem, {
        actions: [
            {
                rel: "event-details",
                icon: "info",
                click: (actionCtx: any) => {
                    const entry = actionCtx.data as EventLogEntry;
                    let message = "";
                    if (entry.error) message += `Error: ${entry.error}\n\n`;
                    if (entry.request) message += `--- Request ---\n${entry.request}\n\n`;
                    if (entry.response) message += `--- Response ---\n${entry.response}`;
                    if (!message) message = entry.success ? "Action completed successfully." : "No details available.";
                    new TestResultForm(
                        `${entry.actionType}: ${entry.actionDetail}`,
                        { success: entry.success, message: message.trim() }
                    ).show();
                },
            },
        ],
        headers: ["TIME", "TRIGGER", "TARGET", "ACTION", "DETAIL", "STATUS"],
        classes: ["", "", "", "", "d-none d-md-table-cell", ""],
        rows: entries.map((e, idx) => ({
            id: String(idx),
            data: e,
            columns: [
                formatDMYTime(e.timestamp),
                e.triggerType,
                e.targetPath
                    ? `<a href="${e.targetPath}">${e.targetName}</a>`
                    : e.targetName,
                e.actionType,
                e.actionDetail,
                e.success
                    ? '<span class="text-success">OK</span>'
                    : `<span class="text-danger" title="${(e.error || "").replace(/"/g, "&quot;")}">FAIL</span>`,
            ],
        })),
    });

    contentElem.append(`<a href="#callouts" class="btn btn-sm btn-outline-secondary mt-2">Back to Callouts</a>`);
};
