const Chart = require("chart.js");

module.exports = {
    doChart: (arr, type, options) => {
        var ctx = document.getElementById('myChart').getContext('2d');
        var myChart = new Chart(ctx, {
            "type": type,
            "data": arr,
            "options": options
        });
    }
}