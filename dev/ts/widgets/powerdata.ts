import {post, graphql} from "../fetch-util";
import {DateSelectForm} from "../forms/date-select";
import {DataEvent} from "../forms-util";
import { addChartContainer } from "../../js/charts-util";
import moment, { Moment } from "moment";

// declarations
let visibleDates : any[] = [];

export default async (elem: JQuery<HTMLElement>) => {
    const chartCtx = addChartContainer(elem, {
        title: "Power Prices (kr/kWh)",
        actions: [{
            "id": "save",
            "icon": "fa-save",
            "callback": () => {
                post(`/api/v1/data/power`, {
                    "dates": visibleDates,
                    "type": "csv"
                }).then(obj => {
                    window.open(`/download/power/${obj.downloadKey}/attachment`, "_new");
                })
            }
        },
        {
            "id": "calendar",
            "icon": "fa-calendar",
            "callback": () => {
                selectDateAndLoadPowerData();
            }
        }
        ]
    })

    const selectDateAndLoadPowerData = () => {
        new DateSelectForm().addEventListener("data", e => {
            const ev = e as DataEvent;
            loadAndShowPowerdata(ev.data.date);
        }).show();
    };

    // load power data
    const loadAndShowPowerdata = input => {
        // construct query
        const dates = (Array.isArray(input) ? input : [input]);
        let powerquery = "query {";
        (Array.isArray(dates) ? dates : [dates]).forEach((d, idx) => {
            powerquery += `query${idx}: powerPriceQuery(filter: {date: "${d.format("YYYY-MM-DD")}"}){id,name,fromCache,data{x,y}}\n`;
        })
        powerquery += "}";

        // clear chart
        chartCtx.addSkeleton({
            "clearContainer": true
        });

        // get data
        graphql(powerquery, { "noSpinner": true }).then(result => {
            // build labels and datasets
            const labels = result[Object.keys(result)[0]].data.map(v => v.x);
            const datasets = Object.keys(result).reduce((prev, key) => {
                if (!result[key] || !result[key].data || !result[key].data.length) return prev;
                prev.push({
                    label: result[key].name,
                    data: result[key].data.map((v) => v.y),
                });
                return prev;
            }, [] as Record<string, string>[]);

            // do chart
            chartCtx.barChart(
                labels, {
                datasets
            }
            )

            // store dates
            visibleDates = dates.map(d => d.format("YYYY-MM-DD"));
        })
    }

    // build query from today and tomorrow (if available)
    const m = moment().subtract(0, "days");
    let dates : Moment[] = [];
    Array(2).fill(undefined).forEach(d => {
        dates.push(moment(m));
        m.add(1, "day");
    })
    loadAndShowPowerdata(dates);

    // event handler to export data
    $("#powerdata-save").on("click", () => {
        post(`/api/v1/data/power`, {
            "dates": visibleDates,
            "type": "csv"
        }).then(obj => {
            window.open(`/download/power/${obj.downloadKey}/attachment`, "_new");
        })
    })

    // event handler to change date
    $("#powerdata-calendar").on("click", () => {
        selectDateAndLoadPowerData();
    })
}