import {graphql} from "../fetch-util";
import {PowerDataDownloadOptions, addChartContainer} from "../charting/charting";
import moment, { Moment } from "moment";
import DateAction from "../charting/actions/date-action";
import PowerdataSaveAction from "../charting/actions/powerdata-save-action";
import { DataSet } from "../ui-helper";

// declarations
let visibleDates : any[] = [];

export default async (elem: JQuery<HTMLElement>) => {
    const powerpriceChart1 = addChartContainer(elem, {
        title: "Power Prices (kr/kWh)",
        type: "bar",
        actions: [
            new DateAction(),
            new (class extends PowerdataSaveAction {
                protected getDownloadOptions(containerData: any): PowerDataDownloadOptions {
                    const m = containerData.date as Moment;
                    return {
                        output: "excel",
                        type: "power",
                        dates: [m],
                    };
                }
            })(),
        ],
        data: async (containerData) => {
            if (!containerData.date) {
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
            const powerqueries = `{
                qToday: powerPriceQuery(filter: {date: "${strdates[0]}"}){id,name,fromCache,data{x,y}}
                qTomorrow: powerPriceQuery(filter: {date: "${strdates[1]}"}){id,name,fromCache,data{x,y}}
            }`;
            const response = await graphql(powerqueries);

            // return
            const data = [response.qToday as DataSet];
            if (response.qTomorrow.data.length) data.push(response.qTomorrow as DataSet);
            return data;
        },
    });
}