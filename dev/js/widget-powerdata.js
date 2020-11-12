const fetcher = require("./fetch-util");
const formutils = require("./forms-util");
const { barChart, ID_CHART } = require("./charts-util");
const moment = require("moment");
const uiutils = require("./ui-utils");

// declarations
let visibleDates = [];

module.exports = (elem) => {
    elem.html(`
        <div>
            ${uiutils.htmlSectionTitle("Power Prices", "float-left")}
            <i id="powerdata-save" class="btn fa fa-save float-left p-0 ml-2" aria-hidden="true"></i>
            <i id="powerdata-calendar" class="btn fa fa-calendar float-left ml-2 p-0" aria-hidden="true"></i>
        </div>
        <canvas id="${ID_CHART}" data-dates=""></canvas>
    `);

    // load power data - build query 2 days back, today and tomorrow
    const loadAndShowPowerdata = input => {
        // construct query
        const dates = (Array.isArray(input) ? input : [input]);
        let powerquery = "query {";
        (Array.isArray(dates) ? dates : [dates]).forEach((d, idx) => {
            powerquery += `query${idx}: powerQuery(data: {date: "${d.format("YYYY-MM-DD")}"}){id,name,fromCache,data{x,y}}\n`;
        })
        powerquery += "}";

        // get data
        fetcher.graphql(powerquery).then(result => {
            // build labels and datasets
            const labels = result[Object.keys(result)[0]].data.map(v => v.x);
            const datasets = Object.keys(result).reduce((prev, key) => {
                if (!result[key] || !result[key].data || !result[key].data.length) return prev;
                prev.push({
                    "label": result[key].name,
                    "data": result[key].data.map(v => v.y)
                })
                return prev;
            }, [])

            // do chart
            barChart(
                ID_CHART,
                labels, {
                    datasets
                }
            )

            // store dates
            visibleDates = dates.map(d => d.format("YYYY-MM-DD"));
        })
    }
    const m = moment().subtract(2, "days");
    let dates = [];
    Array(4).fill().forEach(d => {
        dates.push(moment(m));
        m.add(1, "day");
    })
    loadAndShowPowerdata(dates);

    // event handler to export data
    $("#powerdata-save").on("click", () => {
        fetcher.post(`/api/v1/data/power`, {
            "dates": visibleDates,
            "type": "csv"
        }).then(obj => {
            window.open(`/download/power/${obj.downloadKey}/attachment`, "_new");
        })
    })

    // event handler to change date
    $("#powerdata-calendar").on("click", () => {
        formutils.appendDateSelectForm(undefined, (data) => {
            loadAndShowPowerdata(data.date);
        })
    })
}