import * as uiutils from "../../js/ui-utils";
import { addChartContainer } from "../../js/charts-util";
import { graphql } from "../fetch-util";
import * as formsutil from "../forms-util";
import {ICONS, RouteAction, createBreadcrumbHeader, createContainers} from "../ui-helper";
import { SensorType, Device, House, Sensor } from "../clientside-types";
import { addAlertsTable } from "../alerts-helper";
import {DeleteForm} from "../forms/delete";
import {DeviceForm} from "../forms/create-edit-device";
import { DeviceJWTForm } from "../forms/device-jwt";
import { SensorForm } from "../forms/create-edit-sensor";
import { DeviceData } from "../forms/device-data";


// create type for data and request it
type RequestedHouse = Required<Pick<House, "id" | "name">>;
type RequestedSensor = Required<Pick<Sensor, "id" | "name" | "favorite" | "icon" | "type" | "scaleFactor">>;
type RequestedDevice = Required<Pick<Device, "id" | "name" | "active">> & {
    house: RequestedHouse;
} & {
    sensors: Array<RequestedSensor>;
};

export default async (elemRoot: JQuery<HTMLElement>, houseId: string, deviceId: string) => {
    // create containers
    const headerContainer = createContainers(elemRoot, "header");
    const sensorsContainer = createContainers(elemRoot, "sensors", "title", "content");

    const createUISensors = async (device: RequestedDevice) => {
        // get element
        const elemSensorsTitle = sensorsContainer.children!.title.elem;

        // define actions
        const actions: RouteAction[] = [
            {
                rel: "create",
                icon: ICONS.plus,
                click: () => {
                    new SensorForm(device).addEventListener("data", document.location.reload).show();
                },
            },
            {
                rel: "refresh",
                icon: ICONS.refresh,
                click: async () => {
                    const data = await graphql(`{device(id: "${deviceId}") {
                            sensors {
                                id,name,favorite,icon,type,scaleFactor
                            }
                        }}`);
                    const sensors = data.device.sensors as Array<RequestedSensor>;
                    updateUISensors(sensors);
                },
            },
            {
                rel: "davicedata",
                icon: ICONS.info,
                click: () => {
                    new DeviceData(device).show();
                },
            },
            {
                rel: "edit",
                icon: ICONS.pencil,
                click: function () {
                    new DeviceForm(device.house, device).show();
                },
            },
            {
                rel: "trash",
                icon: ICONS.trash,
                click: function () {
                    new DeleteForm({
                        title: "Delete Device",
                        message:
                            "Are you absolutely sure you want to DELETE this device? This will also DELETE all sensors for this device. Sensor samples are not deleted from the database.",
                        id: device.id,
                        name: device.name,
                    })
                        .addEventListener("data", async (e) => {
                            const dataEvent = e as formsutil.DataEvent;
                            const data = dataEvent.data;
                            await graphql(`mutation {deleteDevice(data: {id: "${device.id}"})}`);
                            document.location.hash = `#configuration/house/${device.house.id}`;
                        })
                        .show();
                },
            },
            {
                rel: "jwt",
                icon: ICONS.key,
                click: function () {
                    new DeviceJWTForm(device).show();
                },
            },
        ];

        // add title
        uiutils.appendTitleRow(
            elemSensorsTitle,
            device.name,
            actions,
            {
                actionItemsId: "sensors-title",
            }
        );

        // add initial content
        updateUISensors(device.sensors);
    };
    const updateUISensors = async (sensors: RequestedSensor[]) => {
        // get element
        const elemSensorsContent = sensorsContainer.children!.content.elem;
        if (!sensors.length) {
            elemSensorsContent.html("No sensors defined for device.");
            return;
        }
        elemSensorsContent.html("");
        sensors!.sort((a, b) => a.name.localeCompare(b.name));

        // create context for chart and create it
        const gaugeSensors = sensors!.filter((s) => s.type === SensorType.gauge);
        if (gaugeSensors.length) {
            const chartContainer = document.createElement("div");
            elemSensorsContent.append(chartContainer);
            const chartCtx = addChartContainer($(chartContainer), {
                append: true,
                actions: ["INTERVAL", "DOWNLOAD"],
            });
            chartCtx.gaugeChart({
                deviceId,
            });
        }

        uiutils.appendDataTable(elemSensorsContent, {
            headers: ["ICON", "NAME", "TYPE", "ID"],
            classes: ["text-center", "", "d-none d-md-table-cell", "d-none d-sm-table-cell"],
            rows: sensors!.map((sensor) => {
                const type_img = `<i class="fa fa-${sensor.icon}" aria-hidden="true"></i>`;
                return {
                    id: sensor.id,
                    data: sensor,
                    columns: [type_img, sensor.name, sensor.type, sensor.id],
                    click: function () {
                        document.location.hash = `configuration/house/${houseId}/device/${deviceId}/sensor/${sensor.id}`;
                    },
                };
            }),
        });
    };

    const updateUI = async () => {
        // request data
        const data = await graphql(
            `{device(id:"${deviceId}") {
                    id,
                    name,
                    active,
                    house{id,name}, 
                    sensors {
                        id,name,favorite,icon,type,scaleFactor
                    }
                }}`
        );
        const device = data.device as RequestedDevice;

        // build header
        createBreadcrumbHeader(device, headerContainer);

        // build UI for sensors
        createUISensors(device);

        // build UI for alerts
        addAlertsTable(elemRoot, device);
    };
    updateUI();
    
}