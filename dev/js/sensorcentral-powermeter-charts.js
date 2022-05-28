const uiutils = require("./ui-utils");
const forms = require("./forms-util");
const fetcher = require("./fetch-util");
const uuid = require("uuid").v4;
const moment = require("moment-timezone");
const Chart = require("chart.js");
const {utils} = require("./forms-util");
const { TIMEZONE, DATETIME_DATETIME_SHORT } = require("./date-utils");

const ISO8601 = "YYYY-MM-DDTHH:mm:ss.SSS[Z]";

const getState = () => {
    const moment_start = $("#startdt").data("DateTimePicker").date().utc();
    const moment_end = $("#enddt").data("DateTimePicker").date().utc();
    const str_start = moment_start.format(ISO8601);
    const str_end = moment_end.format(ISO8601);
    return {
        "start": moment_start,
        "end": moment_end,
        str_start,
        str_end
    }
}

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

const createChartElement = (elemRoot, title, id) => {
    const elem = elemRoot;
    const elemHeader = document.createElement("h4");
    elemHeader.appendChild(document.createTextNode(title));
    elem.append(elemHeader);
    const elemChart = document.createElement("canvas");
    elemChart.setAttribute("id", id);
    elem.append(elemChart);
    elemChart.setAttribute("class", "mb-4");
    return elemChart;
}

const buildLineChartWithDataset = async (elemChart, datasets) => {
    const filter = (data, every) => {
        return data.filter((d, idx) => idx % every === 0);
    };
    const filterCount = $("#filterCountInput").val();

    const labelSource = datasets[Object.keys(datasets)[0]];
    const labels = filter(labelSource.data, filterCount).map((d) => {
        return moment.utc(d.x).tz(TIMEZONE).format(DATETIME_DATETIME_SHORT);
    });

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

    chartConfig.data.labels = labels;
    chartConfig.data.datasets.push(
        ...Object.keys(datasets).map((key, idx) => {
            return {
                label: `${key.substring(key.indexOf("_") + 1).toUpperCase()}`,
                fill: true,
                backgroundColor: colorMap[Object.keys(colorMap)[idx]],
                borderColor: colorMap[Object.keys(colorMap)[idx]],
                data: filter(datasets[key].data, filterCount),
            };
        })
    );

    // build chart
    const myChart = new Chart(elemChart, chartConfig);
    return myChart;
}

const buildBarChartWithDataset = async (elemChart, dataset) => {
    const labels = dataset.data.map((d) => {
        return d.x;
    });

    const chartData = {
        labels: [],
        datasets: [],
    };
    const chartConfig = {
        type: "bar",
        data: chartData,
        options: {
            scales: {
                x: {
                    type: "time",
                },
            },
        },
    };

    chartConfig.data.labels = labels;
    chartConfig.data.datasets = [
        {
            label: `Forbrug`,
            fill: true,
            backgroundColor: colorMap.green,
            borderColor: colorMap.green,
            data: dataset.data
        }
    ];

    // build chart
    const myChart = new Chart(elemChart, chartConfig);
    return myChart;
};

const loadPowerConsumptionData = async (subscription) => {
    const state = getState();
    const query = `{consumption: powerConsumptionQuery(
            filter: {
              id: "${subscription.sensorId}", 
              start: "${state.str_start}",
              end: "${state.str_end}",
            }
          ) {
            id, name, data{x,y}
          }}`;
    const dataset = await fetcher.graphql(query);
    return dataset.consumption;
};

const loadChartData = async (subscription, house, type) => {
    const state = getState();
    console.log(`${state.str_start} - ${state.str_end}`);

    console.log(`Processing subscription`, subscription);
    const queries = [];
    [type].forEach((type) => {
        console.log(`Processing type: ${type}`);
        new Array(3).fill(undefined).forEach((v, idx) => {
            const phase = `l${idx + 1}`;
            console.log(`Processing phase: ${phase}`);
            queries.push(`${type}_${phase}: powerPhaseDataQuery(
            filter: {
              id: "${subscription.sensorId}", 
              phase: ${phase},
              type: ${type},
              start: "${state.str_start}",
              end: "${state.str_end}",
            },
            format: {
              sortAscending: true
            }
          ) {
            id, name, data{x,y}
          }`);
        });
    });
    const results = await fetcher.graphql(`{${queries.join("\n")}}`);
    return results;
};

const buildChartForHouse = async (elemRoot, house) => {
    const data = await fetcher.graphql(`{
        subscriptions: smartmeGetSubscriptions {sensorId, houseId}
    }`);
    const subscriptions = data.subscriptions;

    const elemChartCurrent = createChartElement(elemRoot, "Strøm", "chart_current");
    const elemChartVoltage = createChartElement(elemRoot, "Spænding", "chart_voltage");
    const elemChartPowerCombined = createChartElement(elemRoot, "Effekt samlet (watt)", "chart_power1");
    const elemChartPowerPerPhase = createChartElement(elemRoot, "Effekt per fase (watt)", "chart_power2");
    const elemChartPowerConsumption = createChartElement(elemRoot, "Forbrug (kWh)", "chart_power3");
    subscriptions.filter(sub => sub.houseId === house.id).forEach(sub => {
        // load data
        const datasetPowerConsumption = loadPowerConsumptionData(sub);
        const datasetsCurrent = loadChartData(sub, house, "current");
        const datasetsVoltage = loadChartData(sub, house, "voltage");
        const datasetsPower = loadChartData(sub, house, "power");

        // build charts
        datasetsCurrent.then((datasets) => buildLineChartWithDataset(elemChartCurrent, datasets));
        datasetsVoltage.then((datasets) => buildLineChartWithDataset(elemChartVoltage, datasets));
        datasetsPower.then((datasets) => {
            // create chart with power per phase
            buildLineChartWithDataset(elemChartPowerPerPhase, datasets);

            // combine 3 phases into 1
            const dataset = {
                "id": datasets.power_l1.id,
                "name": datasets.power_l1.name,
                "data": []
            };
            const newDatasets = {"power_L1-L3": dataset};
            datasets.power_l1.data.forEach((d, idx) => {
                dataset.data.push({
                    x: d.x,
                    y: datasets.power_l1.data[idx].y + datasets.power_l2.data[idx].y + datasets.power_l3.data[idx].y,
                });
            })
            buildLineChartWithDataset(elemChartPowerCombined, newDatasets); 
        })
        datasetPowerConsumption.then(dataset => {
            buildBarChartWithDataset(elemChartPowerConsumption, dataset);
        })
    })
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