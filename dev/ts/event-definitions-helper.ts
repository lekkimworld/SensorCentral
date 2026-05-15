import { createContainers } from "./ui-helper";
import * as uiutils from "./ui-utils";
import { Callout, Device, EventDefinition, Sensor } from "./clientside-types";
import { graphql } from "./fetch-util";
import { DeleteForm } from "./forms/delete";
import { EventDefinitionForm } from "./forms/create-edit-event-definition";

type CalloutLookup = Required<Pick<Callout, "id" | "name">>;

const formatActionConfig = (actionType: string, actionConfig: string, callouts: CalloutLookup[]): string => {
    try {
        const config = JSON.parse(actionConfig);
        if (actionType === "callout") {
            const c = callouts.find(c => c.id === config.calloutId);
            return c ? c.name : config.calloutId || "";
        }
        if (actionType === "persist_value") return `value: ${config.value}`;
    } catch {}
    return actionConfig;
};

export const addEventDefinitionsTable = (
    parentElem: JQuery<HTMLElement>,
    target: Device | Sensor,
    isDevice: boolean
) => {
    const container = createContainers(parentElem, "eventdefs", "title", "content");
    const titleElem = container.children!.title.elem;
    const contentElem = container.children!.content.elem;

    uiutils.appendTitleRow(titleElem, "Event Definitions", [
        {
            rel: "create",
            icon: "plus",
            click: async () => {
                new EventDefinitionForm(target, isDevice).show();
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
            eventDefinitions(targetId: "${target.id}") {
                id, triggerType, actionType, actionConfig, active
            }
            callouts { id, name }
        }`);
        const defs = (data.eventDefinitions || []) as EventDefinition[];
        const callouts = (data.callouts || []) as CalloutLookup[];

        if (!defs.length) {
            contentElem.html("No event definitions.");
            return;
        }

        uiutils.appendDataTable(contentElem, {
            actions: [
                {
                    rel: "trash",
                    icon: "trash",
                    click: async (actionCtx) => {
                        new DeleteForm({
                            id: actionCtx.id,
                            name: `${actionCtx.data.triggerType} / ${actionCtx.data.actionType}`,
                            title: "Delete Event Definition?",
                            message: "Are you sure you want to delete this event definition?",
                        }).addEventListener("data", async () => {
                            await graphql(`mutation { deleteEventDefinition(id: "${actionCtx.id}") }`);
                            await loadAndRender();
                        });
                    },
                },
            ],
            headers: ["TRIGGER", "ACTION", "CONFIG", "ACTIVE"],
            classes: ["", "", "d-none d-md-table-cell", ""],
            rows: defs.map((d) => ({
                id: d.id!,
                data: d,
                columns: [
                    d.triggerType,
                    d.actionType,
                    formatActionConfig(d.actionType!, d.actionConfig!, callouts),
                    d.active ? "Yes" : "No",
                ],
                click: function () {
                    new EventDefinitionForm(target, isDevice, this.data).show();
                },
            })),
        });
    };

    loadAndRender();
};
