// read environment
import {config as dotenv_config} from "dotenv";
dotenv_config();

// imports
import terminateListener from "../terminate-listener";
//@ts-ignore
import services from "../configure-services";
import { LogService } from "../services/log-service";
import { RedisService } from "../services/redis-service";
import { StorageService } from "../services/storage-service";
import moment from "moment-timezone";
import { DataElement, Dataset } from "../resolvers/data";
import { EventEmitter } from "stream";
import constants from "../constants";
import { DatabaseService } from "../services/database-service";
import { EventService } from "../services/event-service";
const nordpool = require("nordpool");

// add event emitter for signalling
const eventEmitter = new EventEmitter();

// add services
services.registerService(new LogService());
services.registerService(new RedisService());
services.registerService(new EventService());
services.registerService(new StorageService());
services.registerService(new DatabaseService());

// get log service - we know it's ready
const log = services.getService(LogService.NAME) as LogService;

const doWork = async () => {
    // create dataset
    const m = moment();
    const ds = {} as Dataset;
    ds.id = "power";
    ds.name = m.format("DD-MM-YYYY");

    const opts = {
        currency: constants.DEFAULTS.NORDPOOL.CURRENCY,
        area: constants.DEFAULTS.NORDPOOL.AREA,
        date: m.format("YYYY-MM-DD"),
    };

    try {
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
        const storage = (await services.lookupService(StorageService.NAME)) as StorageService;
        await storage.setPowerData(m.format("YYYY-MM-DD"), ds.data);

        // tell we are done
        log.debug("Emitting finish-event to signal we are done loading powerdata");
        eventEmitter.emit("finish");
    } catch (err) {
        eventEmitter.emit("error", err);
    }
};
const wait = () => {
    setTimeout(wait, 1000);
};

eventEmitter.on("finish", () => {
    log.info("Worker done loading powerdata");
    process.exit(0);
});

eventEmitter.on("error", (...args: any[]) => {
    const err = args[0] as Error;
    log.error("Error loading powerdata", err);
    process.exit(1);
});

log.info("Starting worker to load powerdata");
doWork();
wait();

// setup termination listener
terminateListener(() => {
	console.log("Terminating services");
	services.terminate()
	console.log("Terminated services");
});
