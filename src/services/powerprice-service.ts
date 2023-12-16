//@ts-ignore
import services from "../configure-services";
import { StorageService } from "../services/storage-service";
import moment, { Moment } from "moment-timezone";
import { BaseService, DataElement, Dataset } from "../types";
import constants from "../constants";
import { Logger } from "../logger";
import { Prices } from "nordpool";

const logger = new Logger("powerprice-service");

export class PowerpriceService extends BaseService {
    public static NAME = "powerprice";
    storageService!: StorageService;

    constructor() {
        super(PowerpriceService.NAME);
        this.dependencies = [StorageService.NAME];
    }

    init(callback: (err?: Error) => {}, services: BaseService[]) {
        this.storageService = services[0] as StorageService;

        // did init
        callback();
    }

    /**
     * Load power price data for the supplied moment and store the data in 
     * the cache before returning it.
     * 
     * @param m 
     */
    getPowerdataForMoment = async (m: Moment, ignoreCache: boolean): Promise<Dataset> => {
        const strMoment = m.format("YYYY-MM-DD");
        logger.info(`Getting power prices for <${strMoment}>`);

        // create dataset
        let ds = {
            id: "powerprice",
            name: strMoment,
            fromCache: false,
            data: [] as Array<DataElement>
        };

        // see if we could potentially have the data
        const midnight = moment().hour(0).minute(0).second(0).millisecond(0).add(1, "day");
        if (midnight.diff(m) <= 0) {
            // supplied date is in the future
            const tomorrowMidnight = moment().hour(0).minute(0).second(0).millisecond(0).add(2, "day");
            const today2pm = moment().hour(14).minute(0).second(0).millisecond(0);
            if (tomorrowMidnight.diff(m) <= 0) {
                // supplied date is after tomorrow midnight - we never have
                // that data
                return ds;
            } else {
                // we could have the data for tomorrow if it's after 2pm
                if (moment().diff(today2pm) < 0) {
                    // it's before 2pm - we cannot have the data yet
                    return ds;
                }
            }
        }

        // see if we have data in cache if allowed
        if (!ignoreCache) {
            logger.debug(`Looking for power price data in cache for <${strMoment}>`);
            const data = await this.storageService.getPowerPriceData(strMoment);
            if (data) {
                // found in cache
                ds.data = data;
                ds.fromCache = true;
                return ds;
            }
        }

        // get data from nordpool
        const opts = {
            currency: constants.DEFAULTS.NORDPOOL.CURRENCY,
            area: constants.DEFAULTS.NORDPOOL.AREA,
            date: strMoment,
        };

        // fetch data
        const results = await new Prices().hourly(opts);
        if (!results) {
            logger.warn(`Unable to get powerdata for ${strMoment}`);
            throw new Error(`Unable to get powerdata for ${strMoment}`);
        }

        // map data
        ds.data = results.map((v: any) : DataElement => {
            let date = moment.utc(v.date);
            let price = Number.parseFloat((v.value / 1000).toFixed(2)); // unit i MWh
            let time = date.tz(constants.DEFAULTS.TIMEZONE).format("H:mm");
            return {
                x: time,
                y: price
            }
        });

        // cache
        await this.storageService.setPowerPriceData(strMoment, ds.data);

        // return
        return ds;
    }
}
