import {graphql} from "../fetch-util";
import {PowerDataDownloadOptions, addChartContainer} from "../charting/charting";
import moment, { Moment } from "moment";
import DateAction from "../charting/actions/date-action";
import PowerdataSaveAction from "../charting/actions/powerdata-save-action";
import { DataElement, DataSet } from "../ui-helper";
import DateIntervalAction from "../charting/actions/date-interval-action";
import { da } from "date-fns/locale";

// declarations
let visibleDates : any[] = [];

export default async (elem: JQuery<HTMLElement>) => {
    const powerpriceChart1 = addChartContainer(elem, {
        title: "Power Prices (kr/kWh)",
        type: "bar",
        legend: true,
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
                const today = moment.utc().set("hour", 0).set("minute", 0).set("second", 0).set("millisecond", 0);
                //const tomorrow = today.clone().add(1, "day");
                containerData.dates = [today];
            }

            // format date and get data
            const strdates = (containerData.dates as Array<Moment>).map((m) => m.format("YYYY-MM-DD"));
            let powerqueries = "{";
            strdates.forEach((strdate, idx) => {
                powerqueries += `q${idx}: powerPriceQuery(filter: {date: "${strdate}"}){id,name,fromCache,data{x,y}}`;
            });
            powerqueries += "}";
            const response = await graphql(powerqueries);

            // ensure we only have data sets with data
            const data = strdates
                .map((strdate, idx) => {
                    const ds = response[`q${idx}`] as DataSet;
                    ds.group = ds.name;
                    ds.name = `Rå energipris (${ds.name})`;
                    return ds;
                })
                .reduce((prev, ds) => {
                    if (ds.data.length) prev.push(ds);
                    return prev;
                }, [] as Array<DataSet>);

            // if more than one data set change the x elements to include date
            if (data.length > 1) {
                data.forEach((ds) => {
                    ds.data = ds.data.map((elem) => {
                        return {
                            x: elem.x,
                            y: elem.y,
                        } as DataElement;
                    });
                });
            }

            type EnergyPeriod = {
                start: Moment;
                end: Moment;
                prices: Array<number>;
            };
            const periods: Array<EnergyPeriod> = [];
            periods.push({
                start: moment("2023-10-01", "YYYY-MM-DD"),
                end: moment("2024-04-01", "YYYY-MM-DD"),
                prices: [
                    0.15, 0.15, 0.15, 0.15, 
                    0.15, 0.15, 0.46, 0.46, 
                    0.46, 0.46, 0.46, 0.46, 
                    0.46, 0.46, 0.46, 0.46,
                    0.46, 1.37, 1.37, 1.37, 
                    1.37, 0.46, 0.46, 0.46,
                ],
            } as EnergyPeriod);
            periods.push({
                start: moment("2024-04-01", "YYYY-MM-DD"),
                end: moment("2024-10-01", "YYYY-MM-DD"),
                prices: [
                    0.15, 0.15, 0.15, 0.15, 
                    0.15, 0.15, 0.23, 0.23, 
                    0.23, 0.23, 0.23, 0.23, 
                    0.23, 0.23, 0.23, 0.23,
                    0.23, 0.59, 0.59, 0.59, 
                    0.59, 0.23, 0.23, 0.23,
                ],
            } as EnergyPeriod);
            // remove vat as we add that in the end collectively
            periods.forEach((p) => {
                p.prices.map((price) => price * 0.8);
            });

            // add a transport data set
            data.forEach((ds) => {
                periods.filter((p) => {
                    const today = moment();
                    return p.start.isSameOrBefore(today) && p.end.isBefore(today);
                });
                data.push({
                    id: `transport_${ds.group}`,
                    name: `Transport (${ds.group})`,
                    group: ds.group,
                    fromCache: false,
                    data: periods[0].prices.map((p, idx) => {
                        return {
                            x: ds.data[idx].x,
                            y: p,
                        };
                    }),
                } as DataSet);
            });

            // add el-afgift data set
            data.filter(ds => ds.id.indexOf("transport_") < 0).forEach((ds) => {
                data.push({
                    id: `afgift_${ds.group}`,
                    name: `El-afgift (${ds.group})`,
                    group: ds.group,
                    fromCache: false,
                    data: ds.data.map((p, idx) => {
                        return {
                            x: ds.data[idx].x,
                            y: 0.95125 * 0.8,
                        };
                    }),
                } as DataSet);
            });

            // add prices so far per group
            const totals = data.reduce((prev, ds) => {
                if (!(ds.group! in prev)) {
                    prev[ds.group!] = ds.data.map((_) => 0);
                }
                ds.data.forEach((elem, idx) => {
                    prev[ds.group!][idx] += elem.y;
                });
                return prev;
            }, {} as any);

            // add vat per group
            Object.keys(totals).forEach((key, dsIdx) => {
                data.push({
                    id: `vat_${key}`,
                    group: key,
                    name: `Moms (${key})`,
                    fromCache: false,
                    data: totals[key].map((p, idx) => {
                        return {
                            x: data[dsIdx].data[idx].x,
                            y: p * 0.25,
                        } as DataElement;
                    }),
                } as DataSet);
            })
            
            return data;
        },
    });
}