import "reflect-metadata";

jest.mock("../../src/services/powermeter-service", () => ({
    PowermeterService: jest.fn().mockImplementation(() => ({
        schedule: jest.fn(),
        unschedule: jest.fn(),
    })),
}));

jest.mock("../../src/services/callout-cronjob-handler", () => ({
    CalloutCronJobHandler: jest.fn().mockImplementation(() => ({
        schedule: jest.fn(),
        unschedule: jest.fn(),
    })),
}));

import { CronJobSchedulerService, CronJobHandler } from "../../src/services/cronjob-scheduler-service";
import { CronService } from "../../src/services/cron-service";
import { PubsubService } from "../../src/services/pubsub-service";
import { StorageService } from "../../src/services/storage-service";
import { IdentityService } from "../../src/services/identity-service";
import { BackendIdentity, CronJob, CronJobType, Identity } from "../../src/types";

const mockIdentity: BackendIdentity = {
    identity: { callerId: "test-scheduler" } as Identity,
    principal: {
        isUser: () => false,
        isDevice: () => false,
        isSystem: () => true,
    },
    scopes: [],
};

const makeMockPubsub = () => {
    const subscriptions: Record<string, Function> = {};
    return {
        subscribe: jest.fn((topic: string, handler: Function) => {
            subscriptions[topic] = handler;
        }),
        publish: jest.fn(),
        _subscriptions: subscriptions,
    } as unknown as PubsubService & { _subscriptions: Record<string, Function> };
};

const makeMockStorage = (jobs: CronJob[] = []) => ({
    getAllCronJobs: jest.fn().mockResolvedValue(jobs),
    getCronJobs: jest.fn().mockResolvedValue(jobs),
} as unknown as StorageService);

const makeMockIdentityService = () => ({
    getServiceBackendIdentity: jest.fn().mockReturnValue(mockIdentity),
    getImpersonationIdentity: jest.fn().mockReturnValue(mockIdentity),
} as unknown as IdentityService);

const makeMockCronService = () => ({
    add: jest.fn(),
    remove: jest.fn(),
} as unknown as CronService);

const makeMockHandler = () => ({
    schedule: jest.fn(),
    unschedule: jest.fn(),
});

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

describe("CronJobSchedulerService", () => {
    let scheduler: CronJobSchedulerService;
    let pubsub: ReturnType<typeof makeMockPubsub>;
    let storage: ReturnType<typeof makeMockStorage>;
    let identity: ReturnType<typeof makeMockIdentityService>;
    let cron: ReturnType<typeof makeMockCronService>;
    let powermeter: ReturnType<typeof makeMockHandler>;
    let calloutHandler: ReturnType<typeof makeMockHandler>;

    beforeEach(async () => {
        pubsub = makeMockPubsub();
        storage = makeMockStorage([]);
        identity = makeMockIdentityService();
        cron = makeMockCronService();
        powermeter = makeMockHandler();
        calloutHandler = makeMockHandler();
        scheduler = new CronJobSchedulerService();
    });

    const initScheduler = (jobs: CronJob[] = []) => {
        (storage.getAllCronJobs as jest.Mock).mockResolvedValue(jobs);
        return new Promise<void>((resolve) => {
            scheduler.init(() => resolve(), [pubsub, storage, identity, cron, powermeter, calloutHandler] as any);
        });
    };

    describe("init", () => {
        it("should subscribe to create/update/delete topics", async () => {
            await initScheduler();
            expect(pubsub.subscribe).toHaveBeenCalledTimes(3);
            expect(pubsub.subscribe).toHaveBeenCalledWith(
                expect.stringContaining("cronjob.create"),
                expect.any(Function)
            );
            expect(pubsub.subscribe).toHaveBeenCalledWith(
                expect.stringContaining("cronjob.update"),
                expect.any(Function)
            );
            expect(pubsub.subscribe).toHaveBeenCalledWith(
                expect.stringContaining("cronjob.delete"),
                expect.any(Function)
            );
        });

        it("should schedule all active jobs on init", async () => {
            const jobs = [
                makeJob({ id: "j1", jobType: CronJobType.CALLOUT }),
                makeJob({ id: "j2", jobType: CronJobType.SMARTME_POWERMETER }),
            ];
            await initScheduler(jobs);
            expect(calloutHandler.schedule).toHaveBeenCalledWith(jobs[0], cron, mockIdentity);
            expect(powermeter.schedule).toHaveBeenCalledWith(jobs[1], cron, mockIdentity);
        });

        it("should skip inactive jobs on init", async () => {
            const jobs = [makeJob({ id: "j1", active: false })];
            await initScheduler(jobs);
            expect(calloutHandler.schedule).not.toHaveBeenCalled();
            expect(powermeter.schedule).not.toHaveBeenCalled();
        });
    });

    describe("event handling", () => {
        beforeEach(async () => {
            await initScheduler();
        });

        it("should schedule job on create event", () => {
            const job = makeJob({ id: "j-new" });
            const createTopic = Object.keys(pubsub._subscriptions).find(t => t.includes("cronjob.create"))!;
            pubsub._subscriptions[createTopic]({ data: { new: job } });
            expect(calloutHandler.schedule).toHaveBeenCalledWith(job, cron, mockIdentity);
        });

        it("should reschedule job on update event when active", () => {
            const job = makeJob({ id: "j-update", active: true });
            const updateTopic = Object.keys(pubsub._subscriptions).find(t => t.includes("cronjob.update"))!;
            pubsub._subscriptions[updateTopic]({ data: { new: job } });
            expect(calloutHandler.unschedule).toHaveBeenCalledWith("j-update", cron);
            expect(calloutHandler.schedule).toHaveBeenCalledWith(job, cron, mockIdentity);
        });

        it("should unschedule job on update event when inactive", () => {
            const job = makeJob({ id: "j-deactivate", active: false });
            const updateTopic = Object.keys(pubsub._subscriptions).find(t => t.includes("cronjob.update"))!;
            pubsub._subscriptions[updateTopic]({ data: { new: job } });
            expect(calloutHandler.unschedule).toHaveBeenCalledWith("j-deactivate", cron);
            expect(calloutHandler.schedule).not.toHaveBeenCalled();
        });

        it("should unschedule from both handlers on delete event", () => {
            const deleteTopic = Object.keys(pubsub._subscriptions).find(t => t.includes("cronjob.delete"))!;
            pubsub._subscriptions[deleteTopic]({ data: { old: { id: "j-del" } } });
            expect(powermeter.unschedule).toHaveBeenCalledWith("j-del", cron);
            expect(calloutHandler.unschedule).toHaveBeenCalledWith("j-del", cron);
        });
    });

    describe("handler dispatch", () => {
        it("should route callout jobs to callout handler", async () => {
            const job = makeJob({ jobType: CronJobType.CALLOUT });
            await initScheduler([job]);
            expect(calloutHandler.schedule).toHaveBeenCalledTimes(1);
            expect(powermeter.schedule).not.toHaveBeenCalled();
        });

        it("should route smartme jobs to powermeter handler", async () => {
            const job = makeJob({
                jobType: CronJobType.SMARTME_POWERMETER,
                houseId: "house-1",
                config: { smartmeDeviceId: "sm-dev" },
            });
            await initScheduler([job]);
            expect(powermeter.schedule).toHaveBeenCalledTimes(1);
            expect(calloutHandler.schedule).not.toHaveBeenCalled();
        });
    });
});
