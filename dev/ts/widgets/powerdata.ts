import {graphql} from "../fetch-util";
import {PowerDataDownloadOptions, addChartContainer} from "../charting/charting";
import moment, { Moment } from "moment";
import DateAction from "../charting/actions/date-action";
import PowerdataSaveAction from "../charting/actions/powerdata-save-action";
import { DataSet } from "../ui-helper";
import DateIntervalAction from "../charting/actions/date-interval-action";

// declarations
let visibleDates : any[] = [];

export default async (elem: JQuery<HTMLElement>) => {
    const powerpriceChart1 = addChartContainer(elem, {
        title: "Power Prices (kr/kWh)",
        type: "bar",
        actions: [
            new DateAction(),
            new DateIntervalAction(),
            new (class extends PowerdataSaveAction {
                protected getDownloadOptions(containerData: any): PowerDataDownloadOptions {
                    const moments = containerData.dates as Array<Moment>;
                    return {
                        output: "excel",
                        type: "power",
                        dates: moments,
                    };
                }
            })(),
        ],
        data: async (containerData) => {
            if (containerData.date) {
                // single date selection
                containerData.dates = [containerData.date];
                delete containerData.date;
            } else if (containerData.start) {
                // date interval selection
                let d = containerData.start as Moment;
                containerData.dates = [];
                do {
                    containerData.dates.push(d);
                    d = d.clone().add(1, "day");
                    
                } while (d.isBefore(containerData.end));
                delete containerData.start;
                delete containerData.end;
            } else if (!containerData.dates) {
                // set initial dates (today and tomorrow)
                const today = moment
                    .utc()
                    .set("hour", 0)
                    .set("minute", 0)
                    .set("second", 0)
                    .set("millisecond", 0);
                const tomorrow = today.clone().add(1, "day");
                containerData.dates = [today, tomorrow];
            }

            // format date and get data
            const strdates = (containerData.dates as Array<Moment>).map(m => m.format("YYYY-MM-DD"));
            let powerqueries = "{";
            strdates.forEach((strdate, idx) => {
                powerqueries += `q${idx}: powerPriceQuery(filter: {date: "${strdate}"}){id,name,fromCache,data{x,y}}`;
            });
            powerqueries += "}";
            const response = await graphql(powerqueries);

            // return
            const data = strdates.map((_strdate, idx) => {
                return response[`q${idx}`] as DataSet;
            });
            return data;
        },
    });
}