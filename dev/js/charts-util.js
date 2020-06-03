const Chart = require("chart.js");

const formatDate = d => {
    const m = d.getMonth();
    const month = m===0 ? "jan" : m===1 ? "feb" : m === 2 ? "mar" : m === 3 ? "apr" : m ===4 ? "may" : m === 5 ? "jun" : m === 6 ? "jul" : m === 7 ? "aug" : m === 8 ? "sep" : m === 9 ? "oct" : m === 10 ? "nov" : "dec";
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
        myChart =undefined;
    }
    let ctx2d = document.getElementById(id).getContext('2d');
    myChart = new Chart(ctx2d, chartConfig);
}

const lineChart = (id, label, samples, inputOptions = {}) => {
    // build options
    const options = Object.assign({}, inputOptions);
    if (!options.hasOwnProperty("responsive") || typeof options.responsive !== "boolean") {
        options.responsive = true;
    }

    // clone the samples array and sort ascending
    let data = Array.from(samples).sort((a, b) => a.dt-b.dt).map(s => {
        return {
            "x": s.dt,
            "y": s.value
        }
    });

    // build labels array
    const labels = data.map(d => `${formatDate(d.x)} ${formatTime(d.x)}`);

    const chartData = {
        labels,
        "datasets": [{
            label,
            data,
            "pointRadius": 0,
            "fill": false,
            "backgroundColor": backgroundColors[0]
        }]
    }
    const chartOptions = {
        "responsive": options.hasOwnProperty("responsive") && typeof options.responsive === "boolean" ? options.responsive : true
    }
    const chartConfig = {
        "type": options.type || "line",
        "data": chartData,
        "options": chartOptions
    }
    createOrUpdateChart(id, chartConfig);
};

const barChart = (id, labels, data, inputOptions = {}) => {
    // build options
    const options = Object.assign({}, inputOptions);
    if (!options.hasOwnProperty("responsive") || typeof options.responsive !== "boolean") {
        options.responsive = true;
    }
    const datasets = (Array.isArray(data) ? data : [data]).map((ds, idx) => {
        const obj = {
            "data": ds.data.map(e => e.value),
            "label": ds.name,
            "backgroundColor": backgroundColors[idx]
        }
        return obj;
    })
    const chartData = {
        labels,
        datasets
    }
    const chartOptions = {
        "responsive": options.hasOwnProperty("responsive") && typeof options.responsive === "boolean" ? options.responsive : true
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
    barChart
}
