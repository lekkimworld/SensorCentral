import * as uiutils from "../ui-utils";
import { graphql, post } from "../fetch-util";
import detailsGauge from "./sensordetails-gauge";
import detailsDelta from "./sensordetails-delta";
import { SensorDetails } from "./sensordetails-base";
import { Device, House, Sensor, SensorType } from "../clientside-types";
import { RouteAction, createBreadcrumbHeader, createContainers } from "../ui-helper";
import { addAlertsTable } from "../alerts-helper";
import { addEventsTable } from "../events-helper";
import { ManualSampleForm } from "../forms/manual-sample";
import { DeleteForm } from "../forms/delete";
import { SensorForm } from "../forms/create-edit-sensor";
import { DownloadForm } from "../forms/download";
import { DataEvent } from "../forms-util";
import { Moment } from "moment";

type RequestedHouse = Required<Readonly<Pick<House, "id"|"name">>>;
type RequestedDevice = Required<Readonly<Pick<Device, "id"|"name">>>;
type RequestedSensor = Required<Readonly<Pick<Sensor, "id"|"type"|"name"|"label"|"icon"|"favorite"|"scaleFactor">>> & {device: RequestedDevice & {house: RequestedHouse}};

export default async (elemRoot: JQuery<HTMLElement>, sensorId: string) => {
    // fetch sensor
    const data = await graphql(
        `{sensor(id:"${sensorId}"){id, type, name, label, icon, favorite, scaleFactor, device{id,name,house{id,name}}}}`
    );
    const sensor = data.sensor as RequestedSensor;

    // create containers
    const headerContainer = createContainers(elemRoot, "header");
    const sensorsContainer = createContainers(elemRoot, "sensors", "title", "content");

    // create breadcrumbs
    createBreadcrumbHeader(sensor, headerContainer);

    // build ui based on sensor type
    let module: SensorDetails;
    if ([SensorType.gauge, SensorType.binary, SensorType.counter].includes(sensor.type)) {
        module = detailsGauge;
    } else if (SensorType.delta === sensor.type) {
        module = detailsDelta;
    } else {
        elemRoot.append(`Unknown sensor type: ${sensor.type}`);
        return;
    }
    const actions: RouteAction<any>[] = [];
    if (module.actionManualSample) {
        actions.push({
            rel: "create",
            icon: "plus",
            click: async () => {
                new ManualSampleForm(sensor)
                    .addEventListener("postdata", () => {
                        actions.find((a) => a.rel === "refresh")!.click();
                    })
                    .show();
                    return Promise.resolve();
            },
        });
    }
    actions.push({
        rel: "refresh",
        icon: "refresh",
        click: () => {
            sensorsContainer.children!.content.elem.html("");
            module.buildUI(sensorsContainer.children!.content.elem, sensor);
            return Promise.resolve();
        },
    });
    actions.push({
        rel: "favorite",
        icon: sensor.favorite ? "star_filled" : "star_empty",
        click: () => {
            const btn = $('button[rel="favorite"]');
            btn.toggleClass("fa-star");
            btn.toggleClass("fa-star-o");
            if (btn.hasClass("fa-star")) {
                graphql(`mutation {addFavoriteSensor(id: \"${sensor.id}\")}`);
            } else {
                graphql(`mutation {removeFavoriteSensor(id: \"${sensor.id}\")}`);
            }
            return Promise.resolve();
        },
    });
    actions.push({
        rel: "edit",
        icon: "pencil",
        click: () => {
            new SensorForm(sensor.device, sensor).show();
            return Promise.resolve();
        },
    });
    actions.push({
        rel: "trash",
        icon: "trash",
        click: () => {
            new DeleteForm({
                id: sensor.id,
                name: sensor.name,
                title: "Delete Sensor",
                message:
                    "Are you absolutely sure you want to DELETE this sensor? Sensor samples will not be deleted from the database.",
            })
                .addEventListener("data", async () => {
                    await graphql(`mutation {deleteSensor(data: {id: "${sensor.id}"})}`);
                    document.location.hash = `#configuration/house/${sensor.device.house.id}/device/${sensor.device.id}`;
                })
                .show();
                return Promise.resolve();
        },
    });
    actions.push({
        rel: "download",
        icon: "download",
        click: () => {
            const input = {
                supportsGrouping: sensor.type === "delta" || sensor.type === "counter",
            };
            new DownloadForm(input).addEventListener("data", async e => {
                const dataEvent = e as DataEvent;
                const data = dataEvent.data;
                const start = (data.start as Moment).toISOString();
                const end = (data.end as Moment).toISOString();
                const applyScaleFactor = data.scaleFactor as boolean;
                const options = {
                    start, end, scaleFactor: applyScaleFactor, type: data.grouped ? "grouped" : "ungrouped", output: "excel", sensorIds: [sensorId]
                };
                
                // post
                const blob = await post("/api/v1/export/sensordata", options);

                // create link for download
                const file = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.download = `${sensor.id}_${start.replace(/:/g, "")}_${end.replace(/:/g, "")}.xlsx`;
                a.href = file;
                document.querySelector("body")?.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(file);
            }).show();
            return Promise.resolve();
        },
    });

    // create title row
    uiutils.appendTitleRow(sensorsContainer.children!.title.elem, sensor.name, actions);

    // tell module to build ui
    module.buildUI(sensorsContainer.children!.content.elem, sensor);

    // add alerts
    addAlertsTable(elemRoot, sensor);

    // add events
    addEventsTable(elemRoot, sensor);
}
