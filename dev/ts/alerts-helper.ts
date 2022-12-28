import {Container, createContainers} from "./ui-helper";
import * as uiutils from "../js/ui-utils";
import { Alert, Device, Sensor } from "./clientside-types";
import { graphql } from "./fetch-util";
import { AlertForm } from "./forms/create-edit-alert";
import { DeleteForm } from "./forms/delete";

export type UIContext<P, R> = {
    title: Container;
    contents: Container;
    parent: P;
    loadRecords: () => Promise<R[]>;
};

const createUIAlerts = (ctx: UIContext<Device|Sensor, Alert>) => {
    // get element
    const elemAlertsTitle = ctx.title.elem;

    // add title row with actions
    uiutils.appendTitleRow(
        elemAlertsTitle,
        `Alerts`,
        [
            {
                rel: "create",
                icon: "plus",
                click: async () => {
                    new AlertForm(ctx.parent).show();
                },
            },
            {
                rel: "refresh",
                icon: "refresh",
                click: () => {
                    updateUIAlerts(ctx);
                },
            },
        ],
        {
            actionItemsId: "alerts-title",
        }
    );

    // add content
    updateUIAlerts(ctx);
};
const updateUIAlerts = async (ctx: UIContext<Device|Sensor, Alert>) => {
    // get element
    const elemAlertsContent = ctx.contents.elem;
    elemAlertsContent.html("");

    // query for alerts for this target
    const alerts = await ctx.loadRecords();
    if (!alerts.length) {
        elemAlertsContent.html("No alerts defined.");
        return;
    }

    uiutils.appendDataTable(elemAlertsContent, {
        actions: [
            {
                rel: "trash",
                icon: "trash",
                click: async (actionCtx) => {
                    const f = new DeleteForm({
                        id: actionCtx.id,
                        name: actionCtx.data.description,
                        title: "Delete Alert?",
                        message: "Are you absolutely sure you want to DELETE this alert?",
                    }).addEventListener("data", async () => {
                        await graphql(`mutation {
                            deleteAlert(data: {id: "${actionCtx.id}"})
                        }`);
                        updateUIAlerts(ctx);
                    })
                }
            }
        ],
        headers: ["NAME", "TYPE", "ID"],
        classes: ["", "d-none d-md-table-cell", "d-none d-sm-table-cell"],
        rows: alerts.map((a) => {
            return {
                id: a.id,
                data: a,
                columns: [a.description, a.eventType, a.id],
                click: function () {
                    
                },
            };
        }),
    });
};

type RequestedAlert = Required<Pick<Alert, "id" | "description" | "active" | "eventType">>;
export const addAlertsTable = (parentElem: JQuery<HTMLElement>, target: Device|Sensor) => {
    const alertsContainer = createContainers(parentElem, "alerts", "title", "content");

    // build the ui
    createUIAlerts({
        title: alertsContainer.children!.title,
        contents: alertsContainer.children!.content,
        parent: target, 
        loadRecords: async () : Promise<Array<RequestedAlert>> => {
            const data = await graphql(`{
                alerts(active: null, targetId: "${target.id}") {
                    id, active, eventType, description
                }
            }`);
            const alerts = data.alerts as Array<RequestedAlert>;
            return alerts;
        }
    });
};
