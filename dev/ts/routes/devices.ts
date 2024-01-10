import * as uiutils from "../ui-utils";
import { graphql } from "../fetch-util";
import {HouseForm} from "../forms/create-edit-house";
import {DeleteForm} from "../forms/delete";
import {DeviceForm} from "../forms/create-edit-device";
import {HouseAccessForm} from "../forms/house-access";
import * as dateutils from "../date-utils";
import { Device, House } from "../clientside-types";
import { createBreadcrumbHeader, createContainers } from "../ui-helper";

type RequestedHouse = Required<Pick<House, "id" | "name" | "favorite" | "owner">> & {
    devices: Array<Required<Pick<Device, "id" | "name" | "last_ping" | "last_restart" | "active">>>;
};

export default (elemRoot: JQuery<HTMLElement>, houseId: string) => {


    const updateUI = async () => {
        elemRoot.html("");

        // create containers
        const headerContainer = createContainers(elemRoot, "header");
        const houseContainer = createContainers(elemRoot, "house");

        const data = await graphql(
            `{house(id:"${houseId}"){id,name, favorite,owner, devices(active:null) {id,name,last_ping,last_restart,active}}}`
        );
        const house = data.house as RequestedHouse;
        const houseName = house.name;
        const devices = house.devices.sort((a, b) => a.name.localeCompare(b.name));
        const activeDevices = house.devices.filter(d => d.active);
        const inactiveDevices = house.devices.filter(d => !d.active);

        // create breadcrumbs
        createBreadcrumbHeader(house, headerContainer);

        // add header for devices
        uiutils.appendTitleRow(headerContainer.elem, houseName, [
            {
                rel: "create",
                icon: "plus",
                click: async () => {
                    new DeviceForm(house, undefined).addEventListener("data", document.location.reload).show();
                },
            },
            {
                rel: "refresh",
                icon: "refresh",
                click: async () => {
                    updateUI();
                },
            },
            {
                rel: "edit",
                icon: "pencil",
                click: async function () {
                    new HouseForm(house).show();
                },
            },
            {
                icon: "trash",
                rel: "trash",
                click: async function () {
                    new DeleteForm({
                        title: "Delete House?",
                        message:
                            "Are you absolutely sure you want to DELETE this house? This will also DELETE all devices and sensors for this house. Sensor samples are not removed from the database.",
                        id: house.id,
                        name: house.name,
                    })
                        .addEventListener("data", async () => {
                            await graphql(`mutation {deleteHouse(data: {id: "${house.id}"})}`);
                            document.location.hash = "#root";
                        })
                        .show();
                },
            },
            {
                rel: "favorite",
                icon: () => house.favorite ? "star_filled" : "star_empty",
                click: async () => {
                    graphql(`mutation {favoriteHouse(data: {id: "${house.id}"}){id}}`).then((body) => {
                        document.location.reload();
                    });
                },
            },
            {
                icon: "lock",
                rel: "lock",
                visible: () => house.owner,
                click: async function () {
                    new HouseAccessForm(house).show();
                },
            },
        ]);

        // create section for active devices
        const activeDevicesContainer = createContainers(elemRoot, "active-devices", "title", "content");
        uiutils.appendSectionTitle(activeDevicesContainer.children!.title.elem, "Active Devices");
        if (activeDevices.length) {
            uiutils.appendDataTable(activeDevicesContainer.children!.content.elem, {
                headers: ["NAME", "STATUS", "ID"],
                classes: ["", "text-center", "", "d-none d-sm-table-cell"],
                rows: activeDevices
                    .map((device) => {
                        const diff_options = {
                            maxDiff: 12,
                            scale: "minutes",
                            defaultVale: "N/A",
                        };
                        const status = `Last ping: ${dateutils.timeDifferenceAsString(
                            device.last_ping,
                            diff_options
                        )}<br/>Last restart: ${dateutils.timeDifferenceAsString(device.last_restart, diff_options)}`;

                        return {
                            id: device.id,
                            data: device,
                            columns: [device.name, status, device.id],
                            click: function () {
                                document.location.hash = `configuration/house/${houseId}/device/${this.id}`;
                            },
                        };
                    }),
            });
        } else {
            activeDevicesContainer.children!.content.elem.append("There are no active devices.");
        }

        // get inactive devices and only build table if any
        if (!inactiveDevices || !inactiveDevices.length) return;
        const inactiveDevicesContainer = createContainers(elemRoot, "inactive-devices", "title", "content");

        uiutils.appendSectionTitle(inactiveDevicesContainer.children!.title.elem, "Inactive Devices");
        uiutils.appendDataTable(inactiveDevicesContainer.children!.content.elem, {
            headers: ["NAME", "ID"],
            classes: ["", ""],
            rows: inactiveDevices.map((device) => {
                return {
                    id: device.id,
                    data: device,
                    columns: [device.name, device.id],
                    click: function () {
                        document.location.hash = `configuration/house/${house.id}/device/${this.id}`;
                    },
                };
            }),
        });
    };

    // build initial ui
    updateUI();
}