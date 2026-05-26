import { CronService } from "../../src/services/cron-service";

describe("CronService", () => {
    let service: CronService;

    beforeEach(async () => {
        service = new CronService();
        await new Promise<void>((resolve) => {
            service.init(() => resolve(), []);
        });
    });

    afterEach(() => {
        for (const name of Object.keys(service.jobs)) {
            service.remove(name);
        }
    });

    describe("add", () => {
        it("should register a new cron job", () => {
            const callback = jest.fn();
            service.add("test-job", "*/5 * * * *", callback);
            expect(service.jobs["test-job"]).toBeDefined();
            expect(service.jobs["test-job"].isActive).toBe(true);
        });

        it("should stop and replace an existing job with the same name", () => {
            const cb1 = jest.fn();
            const cb2 = jest.fn();
            service.add("dup-job", "*/5 * * * *", cb1);
            const firstJob = service.jobs["dup-job"];
            service.add("dup-job", "*/10 * * * *", cb2);
            expect(firstJob.isActive).toBe(false);
            expect(service.jobs["dup-job"].isActive).toBe(true);
        });

        it("should run immediately when runImmediately is true", (done) => {
            const callback = jest.fn(() => {
                expect(callback).toHaveBeenCalledTimes(1);
                done();
            });
            service.add("immediate-job", "0 0 1 1 *", callback, true);
        });

        it("should store metadata", () => {
            service.add("meta-job", "*/5 * * * *", jest.fn(), false, { userId: "user-1", type: "test" });
            const info = service.list().find(j => j.name === "meta-job");
            expect(info?.metadata).toEqual({ userId: "user-1", type: "test" });
        });
    });

    describe("remove", () => {
        it("should stop and remove a job", () => {
            service.add("removable", "*/5 * * * *", jest.fn());
            expect(service.jobs["removable"]).toBeDefined();
            service.remove("removable");
            expect(service.jobs["removable"]).toBeUndefined();
        });

        it("should no-op for non-existent job", () => {
            expect(() => service.remove("nonexistent")).not.toThrow();
        });
    });

    describe("list", () => {
        it("should return empty array when no jobs", () => {
            expect(service.list()).toEqual([]);
        });

        it("should return info for all registered jobs", () => {
            service.add("job-a", "*/5 * * * *", jest.fn());
            service.add("job-b", "0 8 * * *", jest.fn());
            const list = service.list();
            expect(list).toHaveLength(2);
            expect(list.map(j => j.name).sort()).toEqual(["job-a", "job-b"]);
        });

        it("should include cronTime in listing", () => {
            service.add("cron-check", "30 12 * * 1-5", jest.fn());
            const info = service.list().find(j => j.name === "cron-check");
            expect(info?.cronTime).toBe("30 12 * * 1-5");
        });

        it("should show running state", () => {
            service.add("active-job", "*/5 * * * *", jest.fn());
            const info = service.list().find(j => j.name === "active-job");
            expect(info?.running).toBe(true);
        });

        it("should include nextDate", () => {
            service.add("next-date-job", "*/5 * * * *", jest.fn());
            const info = service.list().find(j => j.name === "next-date-job");
            expect(info?.nextDate).toBeInstanceOf(Date);
            expect(info!.nextDate!.getTime()).toBeGreaterThan(Date.now());
        });
    });
});
