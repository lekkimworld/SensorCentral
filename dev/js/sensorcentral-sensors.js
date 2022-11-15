const uiutils = require("./ui-utils");
const $ = require("jquery");
const { addChartContainer, buildGaugeChart } = require("./charts-util");
const fetcher = require("./fetch-util");
const dateutils = require("./date-utils");
const formsutil = require("./forms-util");

module.exports = (document, elemRoot, ctx) => {
    const houseId = ctx.houseId;
    const deviceId = ctx.deviceId;

    const createSensor = (data) => {
        fetcher.graphql(`mutation {createSensor(data: {deviceId: "${deviceId}", id: "${data.id}", name: "${data.name}", label: "${data.label}", type: "${data.type}", icon: "${data.icon}", scaleFactor: ${data.scaleFactor}}){id}}`).then(() => {
            document.location.reload();
        })
    }
    const editSensor = (data) => {
        fetcher.graphql(`mutation {updateSensor(data: {id: "${data.id}", name: "${data.name}", label: "${data.label}", type: "${data.type}", icon: "${data.icon}", scaleFactor: ${data.scaleFactor}}){id}}`).then(() => {
            document.location.reload();
        })
    }

    const updateUI = () => {
        elemRoot.html("");

        // query for sensors and containing device
        fetcher
            .graphql(
                `{device(id:"${deviceId}"){id,name,house{id,name}}sensorsForDevice(deviceId:"${deviceId}"){id,name,favorite,label,icon,type,scaleFactor}}`
            )
            .then((data) => {
                const sensors = data.sensorsForDevice.sort((a, b) => a.name.localeCompare(b.name));
                const device = data.device;

                elemRoot.html(
                    uiutils.htmlBreadcrumbs([
                        { text: "Home", id: "#root" },
                        { text: "Houses", id: "houses" },
                        { text: device.house.name, id: `house/${device.house.id}` },
                    ])
                );

                uiutils.appendTitleRow(elemRoot, device.name, [
                    {
                        rel: "create",
                        icon: "plus",
                        click: () => {
                            formsutil.appendSensorCreateEditForm(undefined, createSensor);
                        },
                    },
                    {
                        rel: "refresh",
                        icon: "refresh",
                        click: () => {
                            updateUI(elemRoot, ctx);
                        },
                    },
                    {
                        rel: "watchdog",
                        icon: "bullhorn",
                        click: () => {
                            formsutil.appendWatchdogEditForm(device);
                        },
                    },
                    {
                        rel: "davicedata",
                        icon: "info",
                        click: () => {
                            formsutil.appendDeviceDataForm(device);
                        },
                    },
                ]);

                // create context for chart and create it
                const chartCtx = addChartContainer(elemRoot, {
                    append: true,
                    actions: ["INTERVAL", "DOWNLOAD"],
                });
                chartCtx.gaugeChart({
                    deviceId: device.id,
                });

                uiutils.appendDataTable(elemRoot, {
                    actions: [
                        {
                            icon: "pencil",
                            rel: "edit",
                            click: function (ctx) {
                                formsutil.appendSensorCreateEditForm(ctx.data, editSensor);
                            },
                        },
                        {
                            icon: "trash",
                            rel: "trash",
                            click: function (ctx) {
                                formsutil.appendTrashForm(
                                    {
                                        id: ctx.data.id,
                                        name: ctx.data.name,
                                        form: {
                                            title: "Delete Sensor",
                                            message:
                                                "Are you absolutely sure you want to DELETE this sensor? Sensor samples will not be deleted from the database.",
                                        },
                                    },
                                    (ctx) => {
                                        fetcher.graphql(`mutation {deleteSensor(data: {id: "${ctx.id}"})}`).then(() => {
                                            document.location.reload();
                                        });
                                    }
                                );
                            },
                        },
                        {
                            rel: "favorite",
                            icon: (data) => (data.favorite ? "star" : "star-o"),
                            click: (ctx) => {
                                const btn = $(`tr[id="${ctx.id}"] button[rel="favorite"`);
                                if (btn.hasClass("fa-star")) {
                                    btn.removeClass("fa-star");
                                    btn.addClass("fa-star-o");
                                    fetcher.graphql(`mutation {removeFavoriteSensor(id: \"${ctx.id}\")}`);
                                } else {
                                    btn.removeClass("fa-star-o");
                                    btn.addClass("fa-star");
                                    fetcher.graphql(`mutation {addFavoriteSensor(id: \"${ctx.id}\")}`);
                                }
                            },
                        },
                    ],
                    headers: ["ICON", "NAME", "LABEL", "TYPE", "ID"],
                    classes: [
                        "text-center",
                        "",
                        "d-none d-md-table-cell",
                        "d-none d-md-table-cell",
                        "d-none d-sm-table-cell",
                    ],
                    rows: sensors.map((sensor) => {
                        const type_img = `<i class="fa fa-${sensor.icon}" aria-hidden="true"></i>`;
                        return {
                            id: sensor.id,
                            data: sensor,
                            columns: [type_img, sensor.name, sensor.label, sensor.type, sensor.id],
                            click: function () {
                                document.location.hash = `configuration/house/${ctx.houseId}/device/${ctx.deviceId}/sensor/${sensor.id}`;
                            },
                        };
                    }),
                });
            });
    }

    // build initial ui
    updateUI();
}