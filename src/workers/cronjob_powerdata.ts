//@ts-ignore
import services from "../configure-services";
import { StorageService } from "../services/storage-service";
import moment, {Moment} from "moment-timezone";
import { DataElement, Dataset } from "../services/dataquery-service";
import constants from "../constants";
import { Logger } from "../logger";
const nordpool = require("nordpool");

// get logger
const log = new Logger("cronjob-powerdata");

const fetchPowerdataForMoment = async (storage : StorageService, m : Moment) => {
    log.info(`Getting powerdata for: ${m.format("YYYY-MM-DD")}`);
    const ds = {} as Dataset;
    ds.id = "power";
    ds.name = m.format("DD-MM-YYYY");

    const opts = {
        currency: constants.DEFAULTS.NORDPOOL.CURRENCY,
        area: constants.DEFAULTS.NORDPOOL.AREA,
        date: m.format("YYYY-MM-DD"),
    };

    // fetch data
    const results = await new nordpool.Prices().hourly(opts);

    // map data
    ds.data = results.map((v: any) => {
        let date = moment.utc(v.date);
        let price = Number.parseFloat((v.value / 1000).toFixed(2)); // unit i MWh
        let time = date.tz(constants.DEFAULTS.TIMEZONE).format("H:mm");
        const elem = {} as DataElement;
        elem.x = time;
        elem.y = price;
        return elem;
    });

    // cache
    await storage.setPowerPriceData(m.format("YYYY-MM-DD"), ds.data);
}

export default async () => {
    log.info("Starting cronjob to load powerdata");

    const svcs = await services.lookupService([StorageService.NAME]);
    const storage = svcs[0] as StorageService;

    // create moments to fetch for (allways current date but maybe also tomorrow)
    const moments: Moment[] = [];
    const momentToday = moment();
    moments.push(momentToday);
    if (momentToday.tz(constants.DEFAULTS.TIMEZONE).get("hour") > 14) {
        // get for tomorrow
        const momentTomorrow = moment().add(1, "day");
        moments.push(momentTomorrow);
    }

    // create dataset and fetch data for each moment
    try {
        log.info("Starting to load powerdata");
        await Promise.all(
            moments.map((m) => {
                return fetchPowerdataForMoment(storage, m);
            })
        );

        log.info("Done loading powerdata");
    } catch (err) {
        log.error("Error loading powerdata", err);
    }
}
