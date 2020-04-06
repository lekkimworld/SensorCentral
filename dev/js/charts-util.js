const Chart = require("chart.js");


const formatDate = d => {
    const m = d.getMonth();
    const month = m===0 ? "jan" : m===1 ? "feb" : m === 2 ? "mar" : m === 3 ? "apr" : m ===4 ? "may" : m === 5 ? "jun" : m === 6 ? "jul" : m === 7 ? "aug" : m === 8 ? "sep" : m === 9 ? "oct" : m === 10 ? "nov" : "dec";
    return `${d.getDate()} ${month}`;
}

const formatTime = d => {
    return `${d.getHours() < 10 ? "0" + d.getHours() : d.getHours()}:${d.getMinutes() < 10 ? "0" + d.getMinutes() : d.getMinutes()}`;
}

const doChart = (id, label, samples, inputOptions = {}) => {
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
            "backgroundColor": 'rgba(0, 100, 255, 0.4)'
        }]
    }
    const chartOptions = {
        "responsive": options.hasOwnProperty("responsive") && typeof options.responsive === "boolean" ? options.responsive : true
    }
    var ctx2d = document.getElementById(id).getContext('2d');
    var myChart = new Chart(ctx2d, {
        "type": options.type || "line",
        "data": chartData,
        "options": chartOptions
    });
};

module.exports = {
    doChart
}
