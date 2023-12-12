import {Container, createContainers} from "./ui-helper";
import * as uiutils from "../js/ui-utils";
import { Endpoint, OnSensorSampleEvent, Sensor } from "./clientside-types";
import { graphql } from "./fetch-util";
import { DeleteForm } from "./forms/delete";

export type UIContext<P, R> = {
    title: Container;
    contents: Container;
    parent: P;
    loadRecords: () => Promise<R[]>;
};

const createUIEvents = (ctx: UIContext<Sensor, OnSensorSampleEvent>) => {
    // get element
    const elemEventsTitle = ctx.title.elem;

    // add title row with actions
    uiutils.appendTitleRow(
        elemEventsTitle,
        `Events`,
        [
            {
                rel: "create",
                icon: "plus",
                click: async () => {
                    
                },
            },
            {
                rel: "refresh",
                icon: "refresh",
                click: () => {
                    updateUIEvents(ctx);
                },
            },
        ],
        {
            actionItemsId: "events-title",
        }
    );

    // add content
    updateUIEvents(ctx);
};
const updateUIEvents = async (ctx: UIContext<Sensor, OnSensorSampleEvent>) => {
    // get element
    const elemEventsContent = ctx.contents.elem;
    elemEventsContent.html("");

    // query for events for this target
    const events = await ctx.loadRecords();
    if (!events.length) {
        elemEventsContent.html("No events defined.");
        return;
    }

    uiutils.appendDataTable(elemEventsContent, {
        actions: [
            {
                rel: "trash",
                icon: "trash",
                click: async (actionCtx) => {
                    const f = new DeleteForm({
                        id: actionCtx.id,
                        name: actionCtx.data.description,
                        title: "Delete Event?",
                        message: "Are you absolutely sure you want to DELETE this event?",
                    }).addEventListener("data", async () => {
                        await graphql(`mutation {
                            deleteEvent(data: {id: "${actionCtx.id}"})
                        }`);
                        updateUIEvents(ctx);
                    })
                }
            }
        ],
        headers: ["PATH", "METHOD", "BODY TEMPLATE"],
        classes: ["", "d-none d-md-table-cell", "d-none d-sm-table-cell"],
        rows: events.map((e) => {
            return {
                id: e.id,
                data: e,
                columns: [e.path, e.method, e.bodyTemplate],
                click: function () {
                    
                },
            };
        }),
    });
};

type RequestedEvent = Required<Pick<OnSensorSampleEvent, "id" | "path" | "bodyTemplate" | "method">> & {"endpoint": Array<Required<Pick<Endpoint, "id">>>};
type RequestedSensorWithEvents = Required<Pick<Sensor, "id">> & {"events": Array<RequestedEvent>};

export const addEventsTable = (parentElem: JQuery<HTMLElement>, target: Sensor) => {
    const eventsContainer = createContainers(parentElem, "events", "title", "content");

    // build the ui
    createUIEvents({
        title: eventsContainer.children!.title,
        contents: eventsContainer.children!.content,
        parent: target, 
        loadRecords: async () : Promise<Array<RequestedEvent>> => {
            const data = await graphql(`{
                sensor(id: "${target.id}") {
                    id,
                    events {
                        id, path, bodyTemplate, method, endpoint {id}
                    }
                }
            }`);
            const events = (data.sensor as RequestedSensorWithEvents).events as Array<RequestedEvent>;
            return events;
        }
    });
};
