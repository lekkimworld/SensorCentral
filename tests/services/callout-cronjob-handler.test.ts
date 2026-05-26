import { CalloutCronJobHandler } from "../../src/services/callout-cronjob-handler";
import { CronService } from "../../src/services/cron-service";
import { StorageService } from "../../src/services/storage-service";
import { IdentityService } from "../../src/services/identity-service";
import CalloutService from "../../src/services/callout-service";
import { RedisService } from "../../src/services/redis-service";
import { BackendIdentity, CronJob, CronJobType, Identity } from "../../src/types";

const mockIdentity: BackendIdentity = {
    identity: { callerId: "test-callout-handler" } as Identity,
    principal: {
        isUser: () => false,
        isDevice: () => false,
        isSystem: () => true,
    },
    scopes: [],
};

const makeMockCronService = () => {
    const scheduled: Record<string, { cronTime: string; callback: Function }> = {};
    return {
        add: jest.fn((name: string, cronTime: string, callback: Function) => {
            scheduled[name] = { cronTime, callback };
        }),
        remove: jest.fn((name: string) => {
            delete scheduled[name];
        }),
        _scheduled: scheduled,
    } as unknown as CronService & { _scheduled: Record<string, { cronTime: string; callback: Function }> };
};

const makeMockStorage = () => ({
    getSensor: jest.fn().mockResolvedValue({
        id: "sensor-1",
        name: "Test Sensor",
        device: { id: "dev-1", name: "Test Device", house: { id: "house-1", name: "Test House" } },
    }),
    getDevice: jest.fn().mockResolvedValue({
        id: "dev-1",
        name: "Test Device",
        house: { id: "house-1", name: "Test House" },
    }),
} as unknown as StorageService);

const makeMockIdentity = () => ({
    getServiceBackendIdentity: jest.fn().mockReturnValue(mockIdentity),
    getImpersonationIdentity: jest.fn().mockReturnValue(mockIdentity),
} as unknown as IdentityService);

const makeMockCalloutService = () => ({
    calloutByIdWithDetails: jest.fn().mockResolvedValue({
        request: { method: "GET", url: "https://example.com/notify", body: null },
        response: { status: 200, body: "OK" },
    }),
} as unknown as CalloutService);

const makeMockRedis = () => {
    const store: Record<string, string[]> = {};
    return {
        getClient: jest.fn().mockReturnValue({
            lpush: jest.fn(async (key: string, value: string) => {
                if (!store[key]) store[key] = [];
                store[key].unshift(value);
            }),
            ltrim: jest.fn(),
        }),
        expire: jest.fn(),
        _store: store,
    } as unknown as RedisService & { _store: Record<string, string[]> };
};

const makeJob = (overrides: Partial<CronJob> = {}): CronJob => ({
    id: "job-1",
    userId: "user-1",
    jobType: CronJobType.CALLOUT,
    active: true,
    frequencyMinutes: 0,
    calloutId: "callout-1",
    sensorId: "sensor-1",
    config: { cronExpression: "*/5 * * * *" },
    ...overrides,
});

describe("CalloutCronJobHandler", () => {
    let handler: CalloutCronJobHandler;
    let cron: ReturnType<typeof makeMockCronService>;
    let storage: ReturnType<typeof makeMockStorage>;
    let identity: ReturnType<typeof makeMockIdentity>;
    let calloutService: ReturnType<typeof makeMockCalloutService>;
    let redis: ReturnType<typeof makeMockRedis>;

    beforeEach(async () => {
        storage = makeMockStorage();
        identity = makeMockIdentity();
        calloutService = makeMockCalloutService();
        redis = makeMockRedis();
        cron = makeMockCronService();
        handler = new CalloutCronJobHandler();
        await new Promise<void>((resolve) => {
            handler.init(() => resolve(), [storage, identity, calloutService, redis] as any);
        });
    });

    describe("schedule", () => {
        it("should register a cron job with the correct expression", () => {
            const job = makeJob({ config: { cronExpression: "0 8 * * *" } });
            handler.schedule(job, cron, mockIdentity);
            expect(cron.add).toHaveBeenCalledWith(
                "cronjob_job-1",
                "0 8 * * *",
                expect.any(Function),
                false,
                expect.objectContaining({ type: "callout-cronjob", jobId: "job-1" })
            );
        });

        it("should not schedule if jobType is not CALLOUT", () => {
            const job = makeJob({ jobType: CronJobType.SMARTME_POWERMETER });
            handler.schedule(job, cron, mockIdentity);
            expect(cron.add).not.toHaveBeenCalled();
        });

        it("should not schedule if cronExpression is missing", () => {
            const job = makeJob({ config: {} });
            handler.schedule(job, cron, mockIdentity);
            expect(cron.add).not.toHaveBeenCalled();
        });

        it("should not schedule if calloutId is missing", () => {
            const job = makeJob({ calloutId: undefined });
            handler.schedule(job, cron, mockIdentity);
            expect(cron.add).not.toHaveBeenCalled();
        });
    });

    describe("unschedule", () => {
        it("should remove the cron job by name", () => {
            handler.unschedule("job-1", cron);
            expect(cron.remove).toHaveBeenCalledWith("cronjob_job-1");
        });
    });

    describe("execute (via scheduled callback)", () => {
        it("should call calloutByIdWithDetails with sensor target context", async () => {
            const job = makeJob({ sensorId: "sensor-1", deviceId: undefined });
            handler.schedule(job, cron, mockIdentity);

            const callback = cron._scheduled["cronjob_job-1"].callback;
            await callback();

            expect(identity.getServiceBackendIdentity).toHaveBeenCalled();
            expect(identity.getImpersonationIdentity).toHaveBeenCalled();
            expect(storage.getSensor).toHaveBeenCalledWith(mockIdentity, "sensor-1");
            expect(calloutService.calloutByIdWithDetails).toHaveBeenCalledWith(
                mockIdentity,
                "callout-1",
                expect.objectContaining({
                    targetId: "sensor-1",
                    triggerType: "scheduled",
                    target: expect.objectContaining({ id: "sensor-1" }),
                })
            );
        });

        it("should call calloutByIdWithDetails with device target context", async () => {
            const job = makeJob({ sensorId: undefined, deviceId: "dev-1" });
            handler.schedule(job, cron, mockIdentity);

            const callback = cron._scheduled["cronjob_job-1"].callback;
            await callback();

            expect(storage.getDevice).toHaveBeenCalledWith(mockIdentity, "dev-1");
            expect(calloutService.calloutByIdWithDetails).toHaveBeenCalledWith(
                mockIdentity,
                "callout-1",
                expect.objectContaining({
                    targetId: "dev-1",
                    triggerType: "scheduled",
                    target: expect.objectContaining({ id: "dev-1" }),
                })
            );
        });

        it("should log event to Redis on success", async () => {
            const job = makeJob();
            handler.schedule(job, cron, mockIdentity);

            const callback = cron._scheduled["cronjob_job-1"].callback;
            await callback();

            const client = redis.getClient();
            expect(client.lpush).toHaveBeenCalledWith(
                "event_log:user-1",
                expect.stringContaining('"success":true')
            );
            expect(redis.expire).toHaveBeenCalled();
        });

        it("should log event to Redis on failure", async () => {
            (calloutService.calloutByIdWithDetails as jest.Mock).mockRejectedValue(
                new Error("Connection refused")
            );

            const job = makeJob();
            handler.schedule(job, cron, mockIdentity);

            const callback = cron._scheduled["cronjob_job-1"].callback;
            await callback();

            const client = redis.getClient();
            expect(client.lpush).toHaveBeenCalledWith(
                "event_log:user-1",
                expect.stringContaining('"success":false')
            );
            expect(client.lpush).toHaveBeenCalledWith(
                "event_log:user-1",
                expect.stringContaining("Connection refused")
            );
        });

        it("should not execute if no target is set", async () => {
            const job = makeJob({ sensorId: undefined, deviceId: undefined });
            handler.schedule(job, cron, mockIdentity);

            const callback = cron._scheduled["cronjob_job-1"].callback;
            await callback();

            expect(calloutService.calloutByIdWithDetails).not.toHaveBeenCalled();
        });
    });
});
