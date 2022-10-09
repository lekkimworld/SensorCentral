import {
    BaseService,
} from "../types";
import { Logger } from "../logger";
import {CronJob} from "cron";
import constants from "../constants";

const logger = new Logger("cron-service");

export class CronService extends BaseService {
    public static NAME = "cron-subscription";
    jobs: {[key:string]: CronJob} = {};

    constructor() {
        super(CronService.NAME);
    }

    async init(callback: (err?: Error) => {}) {
        // callback
        callback();
    }

    add(name : string, cronTime : string, callback : () => void) {
        if (Object.keys(this.jobs).includes(name)) {
            this.jobs[name].stop();
        }
        const job = new CronJob(cronTime, callback, null, true, constants.DEFAULTS.TIMEZONE);
        job.start();
        this.jobs[name] = job;
    }

    remove(name:string) {
        logger.debug(`Looking up cron job with name <${name}>`);
        const job = this.jobs[name];
        if (job) {
            job.stop();
            delete this.jobs[name];
            logger.debug(`Stopped and deleted cron job with name <${name}>`);
        }
    }
}
