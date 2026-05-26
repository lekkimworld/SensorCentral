import constants from "../constants";
import { BackendIdentity, BaseService, CronJob, CronJobType, InitCallback } from "../types";
import { Logger } from "../logger";
import { PubsubService, TopicMessage } from "./pubsub-service";
import { StorageService } from "./storage-service";
import { IdentityService } from "./identity-service";
import { CronService } from "./cron-service";
import { PowermeterService } from "./powermeter-service";
import { CalloutCronJobHandler } from "./callout-cronjob-handler";

const logger = new Logger("cronjob-scheduler");

export interface CronJobHandler {
    schedule(job: CronJob, cron: CronService, identity: BackendIdentity): void;
    unschedule(jobId: string, cron: CronService): void;
}

export class CronJobSchedulerService extends BaseService {
    public static NAME = "cronjob-scheduler";
    private pubsub!: PubsubService;
    private storage!: StorageService;
    private identity!: IdentityService;
    private cron!: CronService;
    private powermeter!: PowermeterService;
    private calloutHandler!: CalloutCronJobHandler;
    private authUser!: BackendIdentity;

    constructor() {
        super(CronJobSchedulerService.NAME);
        this.dependencies = [
            PubsubService.NAME,
            StorageService.NAME,
            IdentityService.NAME,
            CronService.NAME,
            PowermeterService.NAME,
            CalloutCronJobHandler.NAME,
        ];
    }

    async init(callback: InitCallback, services: BaseService[]) {
        this.pubsub = services[0] as PubsubService;
        this.storage = services[1] as StorageService;
        this.identity = services[2] as IdentityService;
        this.cron = services[3] as CronService;
        this.powermeter = services[4] as PowermeterService;
        this.calloutHandler = services[5] as CalloutCronJobHandler;

        this.authUser = this.identity.getServiceBackendIdentity(CronJobSchedulerService.NAME);

        this.pubsub.subscribe(
            `${constants.TOPICS.CONTROL}.cronjob.create`,
            this.onCronJobCreate.bind(this)
        );
        this.pubsub.subscribe(
            `${constants.TOPICS.CONTROL}.cronjob.update`,
            this.onCronJobUpdate.bind(this)
        );
        this.pubsub.subscribe(
            `${constants.TOPICS.CONTROL}.cronjob.delete`,
            this.onCronJobDelete.bind(this)
        );

        const cronJobs = await this.storage.getAllCronJobs(this.authUser);
        logger.info(`Loading ${cronJobs.length} cron job(s) from database`);
        for (const job of cronJobs) {
            if (job.active) {
                this.scheduleJob(job);
            } else {
                logger.info(`Skipping inactive cron job <${job.id}> for user <${job.userId}>`);
            }
        }

        callback();
    }

    private getHandler(jobType: CronJobType): CronJobHandler | undefined {
        switch (jobType) {
            case CronJobType.SMARTME_POWERMETER:
                return this.powermeter;
            case CronJobType.CALLOUT:
                return this.calloutHandler;
            default:
                return undefined;
        }
    }

    private scheduleJob(job: CronJob) {
        const handler = this.getHandler(job.jobType);
        if (!handler) {
            logger.warn(`No handler for job type <${job.jobType}> (job <${job.id}>)`);
            return;
        }
        handler.schedule(job, this.cron, this.authUser);
    }

    private unscheduleJob(jobId: string, jobType: CronJobType) {
        const handler = this.getHandler(jobType);
        if (handler) {
            handler.unschedule(jobId, this.cron);
        }
    }

    private onCronJobCreate(result: TopicMessage) {
        const msg = result.data as any;
        const job = msg.new as CronJob;
        logger.info(`Cron job created <${job.id}> — scheduling`);
        this.scheduleJob(job);
    }

    private onCronJobUpdate(result: TopicMessage) {
        const msg = result.data as any;
        const job = msg.new as CronJob;
        this.unscheduleJob(job.id, job.jobType);
        if (job.active) {
            logger.info(`Cron job updated <${job.id}> — rescheduling`);
            this.scheduleJob(job);
        } else {
            logger.info(`Cron job updated <${job.id}> — now inactive, unscheduled`);
        }
    }

    private onCronJobDelete(result: TopicMessage) {
        const msg = result.data as any;
        const jobId = msg.old.id;
        logger.info(`Cron job deleted <${jobId}> — unscheduling`);
        // Try both handlers since we don't know the type from delete event
        this.powermeter.unschedule(jobId, this.cron);
        this.calloutHandler.unschedule(jobId, this.cron);
    }
}
