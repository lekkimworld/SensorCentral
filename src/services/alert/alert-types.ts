import { Logger } from "../../logger";
import { Device, NotifyUsing, Sensor } from "../../types";
import { v4 as uuid } from "uuid";
import Watchdog from "watchdog";

// logger
const logger = new Logger("alert-types");

export enum AlertEventType {
    onDeviceTimeout = "onDeviceTimeout",
    onDeviceRestart = "onDeviceRestart",
    onDeviceMessage = "onDeviceMessage",
    onDeviceMessageNoSensor = "onDeviceMessageNoSensor",
    onSensorTimeout = "onSensorTimeout",
    onSensorSample = "onSensorSample",
    onSensorValue = "onSensorValue",
}
export enum AlertValueTest {
    equal = "equal",
    greaterOrEqual = "greaterOrEqual",
    greater = "greater",
    lessOrEqual = "lessOrEqual",
    less = "less",
}
export const stringToAlertValueTest = (v: string) => {
    if (v === "equals") return AlertValueTest.equal;
    if (v === "greaterOrEqual") return AlertValueTest.greaterOrEqual;
    if (v === "greater") return AlertValueTest.greater;
    if (v === "lessOrEqual") return AlertValueTest.lessOrEqual;
    if (v === "less") return AlertValueTest.less;
    throw new Error(`${v} is not a valid AlertValueTest`);
};

export abstract class AlertNotifyData {}
export abstract class AlertEventData {}
export class TimeoutAlertEventData extends AlertEventData {
    timeoutMs: number;
    readonly timeout: any = {};

    constructor(timeout: number) {
        super();
        this.timeoutMs = timeout;
        this.timeout.milliseconds = timeout;
        this.timeout.seconds = Math.ceil(timeout / 1000);
        this.timeout.minutes = Math.ceil(timeout / 1000 / 60);
    }
}
export class SensorValueEventData extends AlertEventData {
    test: AlertValueTest;
    value: number;

    match(value: number): boolean {
        switch (this.test) {
            case AlertValueTest.equal:
                return value === this.value;
            case AlertValueTest.less:
                return value < this.value;
            case AlertValueTest.greater:
                return value > this.value;
            case AlertValueTest.lessOrEqual:
                return value <= this.value;
            case AlertValueTest.greaterOrEqual:
                return value >= this.value;
        }
        return false;
    }
}

export abstract class Alert {
    readonly id: string;
    active: boolean = true;
    description: string;
    userId: string | undefined;
    target: Sensor | Device;
    eventType: AlertEventType;
    eventData: AlertEventData;
    notifyType: NotifyUsing = NotifyUsing.none;
    notifyData: AlertNotifyData | undefined;

    constructor(id?: string) {
        if (id) {
            this.id = id;
        } else {
            this.id = uuid();
        }
    }
}

export class _DeviceAlert extends Alert {
    constructor(userId: string, device: Device) {
        super();
        this.userId = userId;
        this.target = device;
    }
}

export class SensorSampleAlert extends Alert {
    constructor(id: string, userId: string, sensor: Sensor) {
        super(id);
        this.userId = userId;
        this.target = sensor;
        this.eventType = AlertEventType.onSensorSample;
    }
}

export class SensorValueAlert extends Alert {
    constructor(id: string, userId: string, sensor: Sensor, data: SensorValueEventData) {
        super(id);
        this.userId = userId;
        this.target = sensor;
        this.eventType = AlertEventType.onSensorValue;
        this.eventData = data;
    }
}

export abstract class TimeoutAlert extends Alert {
    wd: Watchdog;

    constructor(id?: string) {
        super(id);
    }
    abstract feed(): void;
    initTimeout(cb: (a: TimeoutAlert) => void) {
        this.wd = new Watchdog<AlertEventType, Alert>((this.eventData as TimeoutAlertEventData).timeoutMs);
        this.wd.on("reset", () => {
            this.feed();
            cb(this);
        });
        this.feed();
    }
}

/**
 * Alert for watchdog on sensor.
 *
 */
export class SensorTimeoutAlert extends TimeoutAlert {
    constructor(id: string, userId: string | undefined, sensor: Sensor, eventData: TimeoutAlertEventData) {
        super(id);
        this.userId = userId;
        this.target = sensor;
        this.eventType = AlertEventType.onSensorTimeout;
        this.eventData = eventData;
    }

    feed() {
        logger.debug(`Feeding watchdog for target <${this.target.id}>`);
        this.wd.feed({
            type: AlertEventType.onSensorTimeout,
            data: this,
        });
        logger.debug(`Fed watchdog for target <${this.target.id}>`);
    }
}

/**
 * Alert for binary sensors where a timeout means we emit a sensor sample.
 *
 */
export class BinarySensorAlert extends SensorTimeoutAlert {
    constructor(sensor: Sensor, eventData: TimeoutAlertEventData) {
        super(uuid(), undefined, sensor, eventData);
    }
}

/**
 * Alert for watchdog on device.
 *
 */
export class DeviceTimeoutAlert extends TimeoutAlert {
    constructor(id: string, userId: string | undefined, device: Device, eventData: TimeoutAlertEventData) {
        super(id);
        this.userId = userId;
        this.target = device;
        this.eventType = AlertEventType.onDeviceTimeout;
        this.eventData = eventData;
    }

    feed() {
        this.wd.feed({
            type: AlertEventType.onDeviceTimeout,
            data: this,
        });
    }
}
