const uiutils = require("./ui-utils");
const forms = require("./forms-util");
const fetcher = require("./fetch-util");
const uuid = require("uuid").v4;
const moment = require("moment-timezone");
const Chart = require("chart.js");
const {utils} = require("./forms-util");

const createDateTimePicker = (id, incrementDays) => {
    utils.createDateTimePicker(id, { inline: false });
    $(`#${id}`)
        .data("DateTimePicker")
        .date(
            moment()
                .set("hour", 0)
                .set("minute", 0)
                .set("second", 0)
                .set("millisecond", 0)
                .add("days", incrementDays || 0)
        );
};

const colorMap = {
    red: "rgba(255, 99, 132, 0.5)",
    blue: "rgba(54, 162, 235, 0.5)",
    green: "rgba(75, 192, 192, 0.5)",
    grey: "rgb(201, 203, 207)",
    orange: "rgba(255, 159, 64, 0.5)",
    purple: "rgba(153, 102, 255, 0.5)",
    yellow: "rgba(255, 205, 86, 0.5)",
    pink: "rgba(245, 66, 212)",
    black: "rgba(0, 0, 0, 1)",
    darkgreen: "rgba(53, 71, 64)",
};

const loadChartData = async (elemRoot, subscription, house, type) => {
    const chartData = {
        labels: [],
        datasets: [],
    };
    const chartConfig = {
        type: "line",
        data: chartData,
        options: {
            scales: {
                x: {
                    type: "time",
                },
            },
        },
    };

    const ISO8601 = "YYYY-MM-DDTHH:mm:ss.SSS[Z]";
    
    const moment_start = $("#startdt")
        .data("DateTimePicker")
        .date()
        .utc();
    const moment_end = $("#enddt").data("DateTimePicker").date().utc();
    const str_start = moment_start.format(ISO8601);
    const str_end = moment_end.format(ISO8601);
    console.log(`${str_start} - ${str_end}`);

    console.log(`Processing subscription`, subscription);
    const queries = [];
    [type].forEach((type) => {
        console.log(`Processing type: ${type}`);
        new Array(3).fill(undefined).forEach((v, idx) => {
            const phase = `l${idx + 1}`;
            console.log(`Processing phase: ${phase}`);
            queries.push(`${type}_${phase}_${Buffer.from(subscription.sensorId).toString(
                "base64"
            )}: powerPhaseDataQuery(
            filter: {
              id: "${subscription.sensorId}", 
              phase: ${phase},
              type: ${type},
              start: "${str_start}",
              end: "${str_end}",
            },
            format: {
              sortAscending: true
            }
          ) {
            id, name, data{x,y}
          }`);
        });
    });

    const filter = (data, every) => {
        return data.filter((d, idx) => idx % every === 0);
    };
    const filterCount = $("#filterCountInput").val();

    const result = await fetcher.graphql(`{${queries.join("\n")}}`);
    const labelSource = result[Object.keys(result)[0]];
    const labels = filter(labelSource.data, filterCount).map((d) => {
        return moment.utc(d.x).tz("Europe/Copenhagen").format("D/M HH:mm");
    });

    chartConfig.data.labels = labels;
    chartConfig.data.datasets.push(
        ...Object.keys(result).map((key, idx) => {
            return {
                label: `${key.substring(key.indexOf("_") + 1, key.indexOf("_") + 3).toUpperCase()}`,
                fill: true,
                backgroundColor: colorMap[Object.keys(colorMap)[idx]],
                borderColor: colorMap[Object.keys(colorMap)[idx]],
                data: filter(result[key].data, filterCount),
            };
        })
    );

    const elem = elemRoot;
    const elemHeader = document.createElement("h4");
    elemHeader.appendChild(document.createTextNode(type === "voltage" ? "Spænding" : "Strøm"));
    elem.append(elemHeader);
    const elemChart = document.createElement("canvas");
    elemChart.setAttribute("id", `chart_${type}`);
    elem.append(elemChart);
    const myChart = new Chart(elemChart, chartConfig);
};

const buildChartForHouse = async (elemRoot, house) => {
    const data = await fetcher.graphql(`{
    subscriptions: smartmeGetSubscriptions {
      sensorId, houseId
    }
  }`);
    const subscriptions = data.subscriptions;

    subscriptions.forEach((sub) => {
        if (sub.houseId === house.id) {
            console.log("Found subscription for house: " + house.name);
            loadChartData(elemRoot, sub, house, "current").then(() => {
                loadChartData(elemRoot, sub, house, "voltage");
            });
        }
    });
};

const buildBaseUI = (elemRoot, ctx, houses) => {
    // extract favorite house
    const favHouse = (() => {
        const filtered = houses.filter((h) => h.favorite);
        if (filtered.length) return filtered[0];
        return undefined;
    })();

    // build options for houses
    const options = {};
    if (favHouse) options[favHouse.id] = favHouse.name;
    houses
        .filter((h) => !h.favorite)
        .forEach((h) => {
            options[h.id] = h.name;
        });

    // get chart-container and bind method to it
    const rebuildChartHandler = () => {
        const houseId = $("#houseInput").val();
        const house = houses.filter((h) => h.id === houseId)[0];
        const elem = $("#chart-container");
        console.log(`Changing to house <${house.name}>`);
        elem.html("");
        buildChartForHouse(elem, house);
    };

    // clear ui
    elemRoot.html(``);

    // build base ui
    uiutils.appendTitleRow(elemRoot, "Powermeter Charts", [
        {
            rel: "refresh",
            icon: "refresh",
            click: function () {
                rebuildChartHandler();
            },
        },
    ]);
    elemRoot.append(`
        <div class="row">
            <div class="col-lg-3">
                <div class="row"><div class="col-lg-12 col-md-12 col-sm-12">${utils.dropdown(
                    "house",
                    "House",
                    undefined,
                    options,
                    false
                )}</div></div>
                <div class="row"><div class="col-lg-12 col-md-12 col-sm-12">${utils.dropdown(
                    "filterCount",
                    "Sample Filtering",
                    undefined,
                    {
                        1: "Use all samples",
                        10: "Every 10 samples",
                        20: "Every 20 samples",
                        30: "Every 30 samples",
                        60: "Every 60 samples",
                    },
                    false
                )}</div></div>
                <div class="row"><div class="col-lg-12 col-md-12 col-sm-12">${utils.datetimepicker(
                    "startdt",
                    "Start date/time",
                    undefined,
                    true
                )}</div></div>
                <div class="row"><div class="col-lg-12 col-md-12 col-sm-12">${utils.datetimepicker(
                    "enddt",
                    "End date/time",
                    undefined,
                    true
                )}</div></div>
            </div>
            <div class="col-lg-9">
                <div id="chart-container"></div>
            </div>
        </div>
        `);
    $("#filterCountInput").val("30");
    createDateTimePicker("startdt");
    createDateTimePicker("enddt", 1);

    // change handler
    $("#startdt").on("dp.change", rebuildChartHandler);
    $("#enddt").on("dp.change", rebuildChartHandler);
    $("#filterCountInput").on("change", rebuildChartHandler);
    $("#houseInput").on("change", rebuildChartHandler);

    // build the UI for the favorite house
    rebuildChartHandler();
}

module.exports = async (document, elemRoot, ctx) => {
    // get houses and extract favorite
    const data = await fetcher.graphql(`{
        houses {id, name, favorite}
    }`);
    const houses = data.houses;

    // build base UI
    buildBaseUI(elemRoot, ctx, houses);
}