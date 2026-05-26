import moment from "moment-timezone";
import constants from "../constants";
import { BackendIdentity, BaseService, CronJob, CronJobType, Device, InitCallback, Sensor } from "../types";
import { Logger } from "../logger";
import { StorageService } from "./storage-service";
import { IdentityService } from "./identity-service";
import { CronService } from "./cron-service";
import CalloutService from "./callout-service";
import { RedisService } from "./redis-service";
import { CronJobHandler } from "./cronjob-scheduler-service";

const logger = new Logger("callout-cronjob-handler");

export class CalloutCronJobHandler extends BaseService implements CronJobHandler {
    public static NAME = "callout-cronjob-handler";
    private storage!: StorageService;
    private identity!: IdentityService;
    private calloutService!: CalloutService;
    private redis!: RedisService;

    constructor() {
        super(CalloutCronJobHandler.NAME);
        this.dependencies = [StorageService.NAME, IdentityService.NAME, CalloutService.NAME, RedisService.NAME];
    }

    async init(callback: InitCallback, services: BaseService[]) {
        this.storage = services[0] as StorageService;
        this.identity = services[1] as IdentityService;
        this.calloutService = services[2] as CalloutService;
        this.redis = services[3] as RedisService;
        logger.info("Initialized");
        callback();
    }

    schedule(job: CronJob, cron: CronService, _identity: BackendIdentity): void {
        if (job.jobType !== CronJobType.CALLOUT) return;
        const cronExpression = job.config.cronExpression;
        if (!cronExpression || !job.calloutId) {
            logger.warn(`Callout cron job <${job.id}> missing cronExpression or calloutId — skipping`);
            return;
        }

        const jobName = `cronjob_${job.id}`;
        logger.info(`Scheduling callout cron job <${job.id}> with expression <${cronExpression}>`);
        cron.add(jobName, cronExpression, async () => {
            await this.execute(job);
        }, false, { type: "callout-cronjob", jobId: job.id, userId: job.userId });
    }

    unschedule(jobId: string, cron: CronService): void {
        cron.remove(`cronjob_${jobId}`);
    }

    private async execute(job: CronJob) {
        const calloutId = job.calloutId!;
        const targetId = job.sensorId || job.deviceId;
        if (!targetId) {
            logger.warn(`Callout cron job <${job.id}> has no target — skipping execution`);
            return;
        }

        let success = true;
        let error: string | null = null;
        let requestInfo: string | null = null;
        let responseInfo: string | null = null;

        try {
            const svcIdentity = this.identity.getServiceBackendIdentity(CalloutCronJobHandler.NAME);
            const userIdentity = this.identity.getImpersonationIdentity(svcIdentity, job.userId);

            const target = await this.hydrateTarget(job, svcIdentity);
            const ctx = {
                targetId,
                target,
                triggerType: "scheduled",
                timestamp: moment.utc().toISOString(),
            };

            logger.info(`Executing callout <${calloutId}> for cron job <${job.id}> target <${targetId}>`);
            const details = await this.calloutService.calloutByIdWithDetails(userIdentity, calloutId, ctx);
            if (details) {
                requestInfo = `${details.request.method} ${details.request.url}${details.request.body ? "\n" + details.request.body : ""}`;
                responseInfo = `${details.response.status}\n${details.response.body}`;
            }
        } catch (err: any) {
            success = false;
            error = err.message || String(err);
            logger.warn(`Callout cron job <${job.id}> failed: ${error}`);
        }

        await this.logEvent(job.userId, {
            timestamp: moment.utc().toISOString(),
            triggerType: "scheduled",
            targetId: targetId,
            targetName: await this.resolveTargetName(job),
            actionType: "callout",
            actionDetail: `cron job ${job.id}`,
            success,
            error,
            request: requestInfo,
            response: responseInfo,
        });
    }

    private async hydrateTarget(job: CronJob, identity: BackendIdentity): Promise<Sensor | Device | undefined> {
        try {
            if (job.deviceId) {
                return await this.storage.getDevice(identity, job.deviceId);
            } else if (job.sensorId) {
                return await this.storage.getSensor(identity, job.sensorId);
            }
        } catch {}
        return undefined;
    }

    private async resolveTargetName(job: CronJob): Promise<string> {
        try {
            const svcIdentity = this.identity.getServiceBackendIdentity(CalloutCronJobHandler.NAME);
            if (job.deviceId) {
                const device = await this.storage.getDevice(svcIdentity, job.deviceId);
                return `Device: ${device.name}`;
            } else if (job.sensorId) {
                const sensor = await this.storage.getSensor(svcIdentity, job.sensorId);
                return `Sensor: ${sensor.name}`;
            }
        } catch {}
        return job.sensorId || job.deviceId || "unknown";
    }

    private async logEvent(userId: string, entry: Record<string, any>) {
        const key = `event_log:${userId}`;
        const json = JSON.stringify(entry);
        const client = this.redis.getClient();
        const maxEntries = constants.DEFAULTS.EVENT_LOG.MAX_ENTRIES;
        const ttl = constants.DEFAULTS.EVENT_LOG.TTL_SECS;
        await client.lpush(key, json);
        await client.ltrim(key, 0, maxEntries - 1);
        await this.redis.expire(key, ttl);
    }
}
