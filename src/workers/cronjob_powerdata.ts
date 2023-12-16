//@ts-ignore
import services from "../configure-services";
import moment, {Moment} from "moment-timezone";
import constants from "../constants";
import { Logger } from "../logger";
import { PowerpriceService } from "../services/powerprice-service";

// get logger
const log = new Logger("cronjob-powerprice");

export default async () => {
    log.info("Cronjob to load power prices starting");

    const svcs = await services.lookupService([PowerpriceService.NAME]);
    const pp = svcs[0] as PowerpriceService;

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
        log.info("Asking powerprice-service to load power price");
        await Promise.allSettled(
            moments.map((m) => {
                return pp.getPowerdataForMoment(m, true);
            })
        );

        log.info("Cronjob to load power prices done");
    } catch (err) {
        log.error("Error loading power price", err);
    }
}
