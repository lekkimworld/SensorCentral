const Chart = require("chart.js");
const moment = require("moment");
const uiutils = require("./ui-utils");
const fetcher = require("./fetch-util");
const $ = require("jquery");
const dateutils = require("./date-utils");

const ID_CHART = "sensorChart";
const ID_CHART_CONTAINER = "sensorChartContainer";

const MIN_Y_FACTOR = 0.1;
const MAX_Y_FACTOR = 0.1;
const MAX_Y_ADD = 5;

const formatDate = d => {
    const m = d.getMonth();
    const month = m === 0 ? "jan" : m === 1 ? "feb" : m === 2 ? "mar" : m === 3 ? "apr" : m === 4 ? "may" : m === 5 ? "jun" : m === 6 ? "jul" : m === 7 ? "aug" : m === 8 ? "sep" : m === 9 ? "oct" : m === 10 ? "nov" : "dec";
    return `${d.getDate()} ${month}`;
}

const formatTime = d => {
    return `${d.getHours() < 10 ? "0" + d.getHours() : d.getHours()}:${d.getMinutes() < 10 ? "0" + d.getMinutes() : d.getMinutes()}`;
}

const colorMap = {
    red: "rgba(255, 99, 132, 0.5)",
    blue: "rgba(54, 162, 235, 0.5)",
    green: "rgba(75, 192, 192, 0.5)",
    grey: "rgb(201, 203, 207)",
    orange: "rgba(255, 159, 64, 0.5)",
    purple: "rgba(153, 102, 255, 0.5)",
    yellow: "rgba(255, 205, 86, 0.5)",
};
const backgroundColors = Object.values(colorMap);

const charts = {};
const createOrUpdateChart = (id, chartConfig) => {
    let myChart = charts[id];
    if (myChart) {
        myChart.destroy();
        delete charts[id];
    }
    let ctx2d = document.getElementById(id).getContext('2d');
    myChart = new Chart(ctx2d, chartConfig);
    charts[id] = myChart;
}

const setResponsiveFlag = (options) => {
    if (!options.hasOwnProperty("responsive") || typeof options.responsive !== "boolean") {
        options.responsive = true;
    }
}

const lineChart = (id, labels, inputOptions = {}) => {
    // build options
    const options = Object.assign({}, inputOptions);
    setResponsiveFlag(options);

    // get data sets
    if (options.dataset) {
        var datasets = [{
            "label": options.dataset.label,
            "data": options.dataset.data
        }]
    } else if (options.datasets) {
        var datasets = options.datasets;
    }
    datasets.forEach((ds, idx) => {
        if (!ds.backgroundColor) ds.backgroundColor = backgroundColors[idx];
        if (!ds.borderColor) ds.borderColor = backgroundColors[idx];
        ds.pointRadius = 0;
        ds.fill = false;
    })

    const minY = options.min || datasets.reduce((prev, ds) => {
        return ds.data.reduce((prev, e) => e < prev ? e : prev, prev);
    }, 0);
    const maxY = options.max || datasets.reduce((prev, ds) => {
        return ds.data.reduce((prev, e) => e > prev ? e : prev, prev);
    }, 0);

    const chartData = {
        labels,
        datasets
    }
    const chartOptions = {
        "responsive": options.responsive,
        "scales": {
            "xAxes": [{}],
            "yAxes": [{
                "ticks": {
                    "min": minY,
                    "max": Math.ceil(maxY + (maxY * MAX_Y_FACTOR))
                }
            }]
        }
    }
    const chartConfig = {
        "type": "line",
        "data": chartData,
        "options": chartOptions
    };
    createOrUpdateChart(id, chartConfig);
};

const barChart = (id, labels, inputOptions = {}) => {
    // build options
    const options = Object.assign({}, inputOptions);
    setResponsiveFlag(options);

    // create data sets
    if (options.dataset) {
        var datasets = [{
            "label": options.dataset.label,
            "data": options.dataset.data
        }]
    } else if (options.datasets) {
        var datasets = options.datasets;
    }
    datasets.forEach((ds, idx) => {
        if (!ds.backgroundColor) ds.backgroundColor = backgroundColors[idx];
    })

    const minY = options.min || datasets.reduce((prev, ds) => {
        return ds.data.reduce((prev, e) => e < prev ? e : prev, prev);
    }, 0);
    const maxY = options.max || datasets.reduce((prev, ds) => {
        if (options.stacked) {
            const max = ds.data.reduce((prev, e) => e > prev ? e : prev, 0);
            return prev + max;
        } else {
            return ds.data.reduce((prev, e) => e > prev ? e : prev, prev);
        }
    }, 0);

    const chartData = {
        labels,
        datasets
    }
    const chartOptions = {
        "responsive": options.responsive,
        "scales": {
            "xAxes": [{
                "stacked": options.stacked
            }],
            "yAxes": [{
                "ticks": {
                    "min": minY,
                    "max": Math.ceil(maxY + (maxY * MAX_Y_FACTOR))
                },
                "stacked": options.stacked
            }]
        },
    }
    const chartConfig = {
        "type": "bar",
        "data": chartData,
        "options": chartOptions
    };
    createOrUpdateChart(id, chartConfig);
};

const buildGaugeChart = ({ deviceId, sensorIds, sensors, samplesCount }) => {
        return new Promise((resolve, reject) => {
                    if (!deviceId && !sensors && !sensorIds) return Promise.reject(Error("Must supply deviceId, sensors or sensorIds"));
                    if (sensors) {
                        // use the sensors we received
                        resolve(sensors);
                    } else if (deviceId) {
                        fetcher.graphql(`{sensors(data: {deviceId:"${deviceId}"}){id,name}}`).then(data => {
                            resolve(data.sensors);
                        })
                    } else {
                        fetcher.graphql(`query {sensors(data: {sensorIds: [${sensorIds.map(s => `"${s}"`).join()}]}){id,name}}`).then(data => {
                resolve(data.sensors);
            })
        }
    }).then(sensors => {
        if (!sensors || !sensors.length) return Promise.reject(Error("No sensors to chart."));
        const sensorIdsStr = sensors.map(s => `"${s.id}"`);
        return fetcher.graphql(`{ungroupedQuery(data: {sensorIds: [${sensorIdsStr.join()}], decimals: 2, sampleCount: ${samplesCount}}){id, name, data{x,y}}}`);
    }).then(result => {
        const samples = result["ungroupedQuery"];
        return Promise.resolve(samples);
    }).then(samples => {
        if (!samples || !Array.isArray(samples)) return Promise.reject(Error("No data received or samples was not an array of data."));
        if (!samples.length) return Promise.resolve();
        if (samples[0].data.length <= 1) return Promise.reject(Error("Cannot chart as only one sample."));

        // generate labels from first series
        const labels = samples[0].data.map(d => d.x).map(x => dateutils.formatDMYTime(x));

        // build datasets
        const datasets = samples.map(sample => {
            return {
                "label": sample.name,
                "data": sample.data.map(d => d.y)
            }
        })
        return Promise.resolve({
            labels,
            datasets,
            samples
        })
    }).then(data => {
        if (!data) {
            return Promise.reject(Error("No data found for chart."));
        } else {
            // build chart
            $(`#${ID_CHART_CONTAINER}`).html(`<canvas id="${ID_CHART}" width="${window.innerWidth - 20}px" height="300px"></canvas>`)
            lineChart(
                ID_CHART, 
                data.labels, 
                {
                    "datasets": data.datasets
                }
            );
            return Promise.resolve(data.samples);
        }
    }).catch(err => {
        $(`#${ID_CHART_CONTAINER}`).html(err.message);
    })
}

module.exports = {
    lineChart,
    barChart,
    buildGaugeChart,
    ID_CHART,
    ID_CHART_CONTAINER
}