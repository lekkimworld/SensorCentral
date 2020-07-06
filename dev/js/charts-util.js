const Chart = require("chart.js");
const moment = require("moment");

const ID_CHART = "sensorChart";

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

let myChart = undefined;
const createOrUpdateChart = (id, chartConfig) => {
    if (myChart) {
        myChart.destroy();
        myChart = undefined;
    }
    let ctx2d = document.getElementById(id).getContext('2d');
    myChart = new Chart(ctx2d, chartConfig);
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
            "xAxes": [{
            }],
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
            }],
            "yAxes": [{
                "ticks": {
                    "min": minY,
                    "max": Math.ceil(maxY + (maxY * MAX_Y_FACTOR))
                }
            }]
        }
    }
    const chartConfig = {
        "type": "bar",
        "data": chartData,
        "options": chartOptions
    };
    createOrUpdateChart(id, chartConfig);
};

module.exports = {
    lineChart,
    barChart,
    ID_CHART
}
