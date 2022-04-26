import {
    BaseService,
} from "../types";
import { LogService } from "./log-service";
import {CronJob} from "cron";
import constants from "../constants";

export class CronService extends BaseService {
    public static NAME = "cron-subscription";
    logService?: LogService;
    jobs: {[key:string]: CronJob} = {};

    constructor() {
        super(CronService.NAME);
        this.dependencies = [LogService.NAME];
    }

    async init(callback: (err?: Error) => {}, services: BaseService[]) {
        this.logService = services[0] as unknown as LogService;
        
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
        this.logService!.debug(`Looking up cron job with name <${name}>`);
        const job = this.jobs[name];
        if (job) {
            job.stop();
            delete this.jobs[name];
            this.logService!.debug(`Stopped and deleted cron job with name <${name}>`);
        }
    }
}
