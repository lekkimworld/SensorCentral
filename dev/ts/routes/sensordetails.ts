import * as uiutils from "../../js/ui-utils";
import { graphql } from "../fetch-util";
import detailsGauge from "./sensordetails-gauge";
import detailsCounter from "./sensordetails-counter";
import detailsDelta from "./sensordetails-delta";
import { SensorDetails } from "./sensordetails-base";
import { Device, House, Sensor } from "../clientside-types";
import { RouteAction, ActionIcon, createBreadcrumbHeader, createContainers, ICONS } from "../ui-helper";
import { addAlertsTable } from "../alerts-helper";
import { ManualSampleForm } from "../forms/manual-sample";
import { DeleteForm } from "../forms/delete";
import { SensorForm } from "../forms/create-edit-sensor";
import { DownloadForm } from "../forms/download";

type RequestedHouse = Required<Readonly<Pick<House, "id"|"name">>>;
type RequestedDevice = Required<Readonly<Pick<Device, "id"|"name">>>;
type RequestedSensor = Required<Readonly<Pick<Sensor, "id"|"type"|"name"|"label"|"icon"|"favorite"|"scaleFactor">>> & {device: RequestedDevice & {house: RequestedHouse}};



export default async (elemRoot: JQuery<HTMLElement>, sensorId: string) => {
    // fetch sensor
    const data = await graphql(`{sensor(id:"${sensorId}"){id, type, name, label, icon, favorite, scaleFactor, device{id,name,house{id,name}}}}`);
    const sensor = data.sensor as RequestedSensor;

    // create containers
    const headerContainer = createContainers(elemRoot, "header");
    const sensorsContainer = createContainers(elemRoot, "sensors", "title", "content");

    // create breadcrumbs
    createBreadcrumbHeader(sensor, headerContainer);

    // build ui based on sensor type
    let module : SensorDetails;
    if (["gauge", "binary"].includes(sensor.type)) {
        module = detailsGauge;
    } else if (sensor.type === "counter") {
        module = detailsCounter;
    } else if (sensor.type === "delta") {
        module = detailsDelta;
    } else {
        elemRoot.append(`Unknown sensor type: ${sensor.type}`);
        return;
    }
    const actions : RouteAction[] = [];
    if (module.actionManualSample) {
        actions.push(
            {rel :"create", icon: ICONS.plus, click: async () => {
                new ManualSampleForm(sensor).addEventListener("postdata", () => {
                    actions.find(a => a.rel === "refresh")!.click();
                }).show();
            }}
        )
    }
    actions.push(
        {rel :"refresh", icon: ICONS.refresh, click: () => {
            sensorsContainer.children!.content.elem.html("");
            module.buildUI(sensorsContainer.children!.content.elem, sensor);
        }}
    );
    actions.push(
        {rel :"favorite", icon: sensor.favorite ? ICONS.star_filled : ICONS.star_empty, click: () => {
            const btn = $('button[rel="favorite"]');
            btn.toggleClass("fa-star");
            btn.toggleClass("fa-star-o");
            if (btn.hasClass("fa-star")) {
                graphql(`mutation {addFavoriteSensor(id: \"${sensor.id}\")}`);
            } else {
                graphql(`mutation {removeFavoriteSensor(id: \"${sensor.id}\")}`);
            }
        }}
    );
    actions.push(
        {rel :"edit", icon: ICONS.pencil, click: () => {
            new SensorForm(sensor.device, sensor).show();
        }}
    );
    actions.push(
        {rel :"trash", icon: ICONS.trash, click: () => {
            new DeleteForm({
                id: sensor.id,
                name: sensor.name,
                title: "Delete Sensor",
                message: "Are you absolutely sure you want to DELETE this sensor? Sensor samples will not be deleted from the database."
            }).addEventListener("data", async () => {
                await graphql(`mutation {deleteSensor(data: {id: "${sensor.id}"})}`);
                document.location.hash = `#configuration/house/${sensor.device.house.id}/device/${sensor.device.id}`;
            }).show();
        }}
    );
    actions.push({
        rel: "download", icon: ICONS.download, click: () => {
            new DownloadForm(sensor).show();
        }
    })

    // create title row
    uiutils.appendTitleRow(sensorsContainer.children!.title.elem, sensor.name, actions);

    // tell module to build ui
    module.buildUI(sensorsContainer.children!.content.elem, sensor);

    // add alerts
    addAlertsTable(elemRoot, sensor);
}
