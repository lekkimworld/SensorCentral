import {Container, createContainers} from "./ui-helper";
import * as uiutils from "./ui-utils";
import { CalloutEndpoint, OnSensorSampleEvent, Sensor } from "./clientside-types";
import { graphql } from "./fetch-util";

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
                    document.location.hash = `events/create/${ctx.parent.id}`;
                },
            },
            {
                rel: "refresh",
                icon: "refresh",
                click: async () => {
                    updateUIEvents(ctx);
                },
            },
        ]
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
        headers: ["PATH", "METHOD", "BODY TEMPLATE"],
        classes: ["", "d-none d-md-table-cell", "d-none d-sm-table-cell"],
        rows: events.map((e) => {
            return {
                id: e.id,
                data: e,
                columns: [e.path, e.method, e.bodyTemplate || ""],
                click: function () {
                    document.location.hash = `events/edit/${this.data.id}/${ctx.parent.id}`;
                },
            };
        }),
    });
};

type RequestedEvent = Required<Pick<OnSensorSampleEvent, "id" | "path" | "bodyTemplate" | "method">> & {"endpoint": Required<Pick<CalloutEndpoint, "id">>};
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
                        id, path, bodyTemplate, method, contentType, endpoint {id}
                    }
                }
            }`);
            const events = (data.sensor as RequestedSensorWithEvents).events as Array<RequestedEvent>;
            return events;
        }
    });
};
