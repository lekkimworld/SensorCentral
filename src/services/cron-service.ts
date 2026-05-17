import {
    BaseService,
    InitCallback,
} from "../types";
import { Logger } from "../logger";
import {CronJob} from "cron";
import constants from "../constants";

const logger = new Logger("cron-service");

export type CronJobInfo = {
    name: string;
    cronTime: string;
    running: boolean;
    lastDate?: Date;
    nextDate?: Date;
    metadata?: Record<string, any>;
};

export class CronService extends BaseService {
    public static NAME = "cron-subscription";
    jobs: {[key:string]: CronJob} = {};
    private jobInfo: {[key:string]: { cronTime: string; metadata?: Record<string, any> }} = {};

    constructor() {
        super(CronService.NAME);
    }

    async init(callback: InitCallback, _services: BaseService[]) {
        callback();
    }

    add(name: string, cronTime: string, callback: () => void, runImmediately?: boolean, metadata?: Record<string, any>) {
        logger.info(`Scheduling cron job <${name}> at <${cronTime}>${metadata?.userId ? ` for user <${metadata.userId}>` : ""}`);
        if (Object.keys(this.jobs).includes(name)) {
            this.jobs[name].stop();
        }
        const job = CronJob.from({
            cronTime,
            onTick: callback,
            start: true,
            timeZone: constants.DEFAULTS.TIMEZONE
        });
        this.jobs[name] = job;
        this.jobInfo[name] = { cronTime, metadata };

        if (runImmediately) {
            logger.debug(`Asked to run cron job <${name}> immediately on add so doing that...`);
            try {
                global.setImmediate(callback);
            } catch (err) {
                logger.error(`Unable to run cron job <${name}> immediately`, err);
            }
        }
    }

    remove(name: string) {
        const job = this.jobs[name];
        if (job) {
            const info = this.jobInfo[name];
            logger.info(`Unscheduling cron job <${name}>${info?.metadata?.userId ? ` for user <${info.metadata.userId}>` : ""}`);
            job.stop();
            delete this.jobs[name];
            delete this.jobInfo[name];
        }
    }

    list(): CronJobInfo[] {
        return Object.keys(this.jobs).map(name => {
            const job = this.jobs[name];
            const info = this.jobInfo[name];
            return {
                name,
                cronTime: info?.cronTime || "unknown",
                running: job.isActive,
                lastDate: job.lastDate() instanceof Date ? job.lastDate() as Date : undefined,
                nextDate: job.nextDate()?.toJSDate(),
                metadata: info?.metadata,
            };
        });
    }
}
