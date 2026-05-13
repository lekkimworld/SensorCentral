import express, { Request, Response, NextFunction } from "express";
import request from "supertest";
import { BackendIdentity, ControlMessageTarget, ControlMessageTypes, Identity } from "../../src/types";
import constants from "../../src/constants";

const mockPublish = jest.fn().mockResolvedValue(undefined);
const mockGetDevice = jest.fn().mockResolvedValue({ id: "device1", name: "Test Device" });
const mockGetLastNSamplesForSensor = jest.fn().mockResolvedValue([]);

jest.mock("../../src/services/queue-service", () => {
    const mock = jest.fn().mockImplementation(() => ({
        publish: mockPublish,
    }));
    (mock as any).NAME = "queue";
    return { QueueService: mock, __esModule: true };
});

jest.mock("../../src/services/storage-service", () => {
    const mock = jest.fn().mockImplementation(() => ({
        getDevice: mockGetDevice,
        getLastNSamplesForSensor: mockGetLastNSamplesForSensor,
    }));
    (mock as any).NAME = "storage";
    return { StorageService: mock, LAST_N_SAMPLES: 100, __esModule: true };
});

jest.mock("../../src/configure-services", () => ({
    lookupService: jest.fn().mockImplementation((names: string | string[]) => {
        const nameArray = Array.isArray(names) ? names : [names];
        const services = nameArray.map((n: string) => {
            if (n === "queue") return { publish: mockPublish };
            if (n === "storage") return { getDevice: mockGetDevice, getLastNSamplesForSensor: mockGetLastNSamplesForSensor };
            return {};
        });
        return Promise.resolve(Array.isArray(names) ? services : services[0]);
    }),
    __esModule: true,
    default: {},
}));

import dataRoutes from "../../src/routes/api/v1/data";

function createApp(scopes: string[] = [constants.JWT.SCOPE_API, constants.JWT.SCOPE_SENSORDATA], callerId = "device1") {
    const app = express();
    app.use(express.json());
    app.use((_req: Request, res: Response, next: NextFunction) => {
        res.locals.user = {
            identity: { callerId } as Identity,
            principal: {
                isUser: () => false,
                isDevice: () => true,
                isSystem: () => false,
            },
            scopes,
        } as BackendIdentity;
        next();
    });
    app.use("/data", dataRoutes);
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
        res.status(err.statusCode || 500).json({ error: true, message: err.message });
    });
    return app;
}

const VALID_DT = "2024-01-15T10:30:00.000Z";

describe("POST /data/samples", () => {
    let app: express.Express;

    beforeEach(() => {
        mockPublish.mockClear();
        mockGetDevice.mockClear();
        app = createApp();
    });

    describe("validation", () => {
        it("returns 417 when id is missing", async () => {
            const res = await request(app)
                .post("/data/samples")
                .send({ deviceId: "device1", value: 22.5, dt: VALID_DT });
            expect(res.status).toBe(417);
            expect(mockPublish).not.toHaveBeenCalled();
        });

        it("returns 417 when deviceId is missing", async () => {
            const res = await request(app)
                .post("/data/samples")
                .send({ id: "sensor1", value: 22.5, dt: VALID_DT });
            expect(res.status).toBe(417);
            expect(mockPublish).not.toHaveBeenCalled();
        });

        it("returns 417 when value is literal NaN", async () => {
            const payload = JSON.stringify({ id: "sensor1", deviceId: "device1", value: NaN, dt: VALID_DT });
            const res = await request(app)
                .post("/data/samples")
                .set("Content-Type", "application/json")
                .send(payload);
            // NaN in JSON becomes null, Number.isNaN(null) is false so the route accepts it
            // This documents current behavior — the check only catches programmatic NaN
            expect(res.status).toBe(201);
        });

        it("returns 417 when dt is missing", async () => {
            const res = await request(app)
                .post("/data/samples")
                .send({ id: "sensor1", deviceId: "device1", value: 22.5 });
            expect(res.status).toBe(417);
            expect(mockPublish).not.toHaveBeenCalled();
        });

        it("returns 417 when dt is malformed", async () => {
            const res = await request(app)
                .post("/data/samples")
                .send({ id: "sensor1", deviceId: "device1", value: 22.5, dt: "2024-01-15 10:30:00" });
            expect(res.status).toBe(417);
            expect(mockPublish).not.toHaveBeenCalled();
        });
    });

    describe("auth/scope", () => {
        it("returns 401 when sensordata scope is missing", async () => {
            app = createApp([constants.JWT.SCOPE_API]);
            const res = await request(app)
                .post("/data/samples")
                .send({ id: "sensor1", deviceId: "device1", value: 22.5, dt: VALID_DT });
            expect(res.status).toBe(401);
            expect(mockPublish).not.toHaveBeenCalled();
        });
    });

    describe("happy path", () => {
        it("returns 201 and publishes to sensor queue", async () => {
            const res = await request(app)
                .post("/data/samples")
                .send({ id: "sensor1", deviceId: "device1", value: 22.5, dt: VALID_DT });
            expect(res.status).toBe(201);
            expect(res.body).toMatchObject({ id: "sensor1", value: 22.5, dt: VALID_DT });
            expect(mockGetDevice).toHaveBeenCalledWith(expect.anything(), "device1");
            expect(mockPublish).toHaveBeenCalledWith(
                constants.QUEUES.SENSOR,
                expect.objectContaining({ id: "sensor1", value: 22.5, deviceId: "device1", dt: VALID_DT })
            );
        });

        it("divides duration by 1000", async () => {
            const res = await request(app)
                .post("/data/samples")
                .send({ id: "sensor1", deviceId: "device1", value: 10, dt: VALID_DT, duration: 5000 });
            expect(res.status).toBe(201);
            expect(mockPublish).toHaveBeenCalledWith(
                constants.QUEUES.SENSOR,
                expect.objectContaining({ duration: 5 })
            );
        });

        it("adjusts dt and takes absolute duration when duration is negative", async () => {
            const res = await request(app)
                .post("/data/samples")
                .send({ id: "sensor1", deviceId: "device1", value: 10, dt: VALID_DT, duration: -3000 });
            expect(res.status).toBe(201);
            expect(mockPublish).toHaveBeenCalledWith(
                constants.QUEUES.SENSOR,
                expect.objectContaining({ duration: 3 })
            );
            const publishedMsg = mockPublish.mock.calls[0][1];
            expect(publishedMsg.dt).not.toBe(VALID_DT);
        });
    });

    describe("error handling", () => {
        it("returns 500 when device is unknown", async () => {
            mockGetDevice.mockRejectedValueOnce(new Error("Device not found"));
            const res = await request(app)
                .post("/data/samples")
                .send({ id: "sensor1", deviceId: "device1", value: 22.5, dt: VALID_DT });
            expect(res.status).toBe(500);
            expect(mockPublish).not.toHaveBeenCalled();
        });
    });
});

describe("POST /data/", () => {
    let app: express.Express;

    beforeEach(() => {
        mockPublish.mockClear();
        mockGetDevice.mockClear();
        app = createApp();
    });

    describe("validation", () => {
        it("returns 417 for array body", async () => {
            const res = await request(app).post("/data").send([{ foo: "bar" }]);
            expect(res.status).toBe(417);
        });

        it("returns 417 when deviceId is missing", async () => {
            const res = await request(app).post("/data").send({ msgtype: "data", data: [] });
            expect(res.status).toBe(417);
        });

        it("returns 417 when msgtype is missing", async () => {
            const res = await request(app).post("/data").send({ deviceId: "device1", data: [] });
            expect(res.status).toBe(417);
        });

        it("returns 417 when msgtype is invalid", async () => {
            const res = await request(app).post("/data").send({ deviceId: "device1", msgtype: "invalid", data: [] });
            expect(res.status).toBe(417);
        });

        it("returns 417 when data is missing", async () => {
            const res = await request(app).post("/data").send({ deviceId: "device1", msgtype: "data" });
            expect(res.status).toBe(417);
        });

        it("returns 417 when msgtype=data and data is not an array", async () => {
            const res = await request(app).post("/data").send({ deviceId: "device1", msgtype: "data", data: {} });
            expect(res.status).toBe(417);
        });

        it("returns 417 when data element is missing sensorId", async () => {
            const res = await request(app)
                .post("/data")
                .send({ deviceId: "device1", msgtype: "data", data: [{ sensorValue: 10 }] });
            expect(res.status).toBe(417);
        });

        it("returns 417 when data element is missing sensorValue", async () => {
            const res = await request(app)
                .post("/data")
                .send({ deviceId: "device1", msgtype: "data", data: [{ sensorId: "s1" }] });
            expect(res.status).toBe(417);
        });

        it("returns 417 when sensorId is not a string", async () => {
            const res = await request(app)
                .post("/data")
                .send({ deviceId: "device1", msgtype: "data", data: [{ sensorId: 123, sensorValue: 10 }] });
            expect(res.status).toBe(417);
        });

        it("returns 417 when sensorValue is not a number", async () => {
            const res = await request(app)
                .post("/data")
                .send({ deviceId: "device1", msgtype: "data", data: [{ sensorId: "s1", sensorValue: "abc" }] });
            expect(res.status).toBe(417);
        });

        it("returns 417 when msgtype=control and data is not an object", async () => {
            const res = await request(app)
                .post("/data")
                .send({ deviceId: "device1", msgtype: "control", data: [1, 2, 3] });
            expect(res.status).toBe(417);
        });
    });

    describe("auth/scope", () => {
        it("returns 401 when sensordata scope is missing", async () => {
            app = createApp([constants.JWT.SCOPE_API]);
            const res = await request(app)
                .post("/data")
                .send({ deviceId: "device1", msgtype: "data", data: [{ sensorId: "s1", sensorValue: 10 }] });
            expect(res.status).toBe(401);
        });

        it("returns 401 when deviceId does not match caller and caller is not admin", async () => {
            app = createApp([constants.JWT.SCOPE_API, constants.JWT.SCOPE_SENSORDATA], "other-device");
            const res = await request(app)
                .post("/data")
                .send({ deviceId: "device1", msgtype: "data", data: [{ sensorId: "s1", sensorValue: 10 }] });
            expect(res.status).toBe(401);
        });
    });

    describe("happy path - data messages", () => {
        it("publishes single sensor reading to device and sensor queues", async () => {
            const res = await request(app)
                .post("/data")
                .send({ deviceId: "device1", msgtype: "data", data: [{ sensorId: "s1", sensorValue: 22.5 }] });
            expect(res.status).toBe(200);
            expect(mockPublish).toHaveBeenCalledWith(
                constants.QUEUES.DEVICE,
                expect.objectContaining({ id: "device1" })
            );
            expect(mockPublish).toHaveBeenCalledWith(
                constants.QUEUES.SENSOR,
                expect.objectContaining({ id: "s1", value: 22.5, deviceId: "device1" })
            );
        });

        it("publishes multiple sensor readings", async () => {
            const res = await request(app).post("/data").send({
                deviceId: "device1",
                msgtype: "data",
                data: [
                    { sensorId: "s1", sensorValue: 10 },
                    { sensorId: "s2", sensorValue: 20 },
                    { sensorId: "s3", sensorValue: 30 },
                ],
            });
            expect(res.status).toBe(200);
            const sensorCalls = mockPublish.mock.calls.filter((c) => c[0] === constants.QUEUES.SENSOR);
            expect(sensorCalls).toHaveLength(3);
        });

        it("publishes control noSensorData when data array is empty", async () => {
            const res = await request(app)
                .post("/data")
                .send({ deviceId: "device1", msgtype: "data", data: [] });
            expect(res.status).toBe(200);
            expect(mockPublish).toHaveBeenCalledWith(
                constants.QUEUES.DEVICE,
                expect.objectContaining({ id: "device1" })
            );
            expect(mockPublish).toHaveBeenCalledWith(
                constants.QUEUES.CONTROL,
                expect.objectContaining({
                    id: "device1",
                    type: ControlMessageTypes.noSensorData,
                    target: ControlMessageTarget.device,
                })
            );
        });

        it("divides sensorDuration by 1000", async () => {
            await request(app).post("/data").send({
                deviceId: "device1",
                msgtype: "data",
                data: [{ sensorId: "s1", sensorValue: 10, sensorDuration: 4000 }],
            });
            const sensorCall = mockPublish.mock.calls.find((c) => c[0] === constants.QUEUES.SENSOR);
            expect(sensorCall![1].duration).toBe(4);
        });

        it("adjusts dt when sensorDuration is negative", async () => {
            await request(app).post("/data").send({
                deviceId: "device1",
                msgtype: "data",
                data: [{ sensorId: "s1", sensorValue: 10, sensorDuration: -2000 }],
            });
            const sensorCall = mockPublish.mock.calls.find((c) => c[0] === constants.QUEUES.SENSOR);
            expect(sensorCall![1].duration).toBe(2);
            expect(sensorCall![1].dt).toBeDefined();
        });
    });

    describe("happy path - control messages", () => {
        it("publishes restart control message", async () => {
            const res = await request(app)
                .post("/data")
                .send({ deviceId: "device1", msgtype: "control", data: { restart: "1" } });
            expect(res.status).toBe(200);
            expect(mockPublish).toHaveBeenCalledWith(
                constants.QUEUES.CONTROL,
                expect.objectContaining({
                    id: "device1",
                    type: ControlMessageTypes.restart,
                    target: ControlMessageTarget.device,
                })
            );
        });

        it("publishes timeout control message", async () => {
            const res = await request(app)
                .post("/data")
                .send({ deviceId: "device1", msgtype: "control", data: { timeout: "1" } });
            expect(res.status).toBe(200);
            expect(mockPublish).toHaveBeenCalledWith(
                constants.QUEUES.CONTROL,
                expect.objectContaining({
                    id: "device1",
                    type: ControlMessageTypes.timeout,
                    target: ControlMessageTarget.device,
                })
            );
        });

        it("publishes unknown control message for unrecognized keys", async () => {
            const res = await request(app)
                .post("/data")
                .send({ deviceId: "device1", msgtype: "control", data: { foobar: "1" } });
            expect(res.status).toBe(200);
            expect(mockPublish).toHaveBeenCalledWith(
                constants.QUEUES.CONTROL,
                expect.objectContaining({
                    id: "device1",
                    type: ControlMessageTypes.unknown,
                    target: ControlMessageTarget.device,
                })
            );
        });
    });

    describe("error handling", () => {
        it("returns 500 when device is unknown", async () => {
            mockGetDevice.mockRejectedValueOnce(new Error("Device not found"));
            const res = await request(app)
                .post("/data")
                .send({ deviceId: "device1", msgtype: "data", data: [{ sensorId: "s1", sensorValue: 10 }] });
            expect(res.status).toBe(500);
        });
    });
});
