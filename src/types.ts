import { Moment } from "moment";

export abstract class BaseService {
    public readonly name : string;
    dependencies : string[] = [];

    constructor(name : string) {
        this.name = name;
    }

    terminate() : Promise<void> {
        return Promise.resolve();
    }
    
    /**
     * Allow service to initiliaze. Service should callback when done. If callback is 
     * done with an error we set the service state to STATE_RETRY_INIT and retry the initialization 
     * of the service in INIT_RETRY_SECONDS seconds.
     */
    init(callback : (err? : Error) => {}, services : BaseService[]) {
        callback();
    }
}

/**
 * The types of ingested control message types we support.
 * 
 */
export enum ControlMessageTypes {
    unknown = "unknown",
    restart = "restart",
    watchdogReset = "watchdogReset"
}

/**
 * Control message ingested from a device.
 * 
 */
export interface IngestedControlMessage {
    id : string;
    type : ControlMessageTypes;
}

/**
 * Message published when we hear from a device.
 * 
 */
export interface IngestedDeviceMessage {
    id : string;
}

/**
 * Message published when we hear from a sensor.
 * 
 */
export interface IngestedSensorMessage {
    id : string;
    value : number;
    deviceId : string;
}

/**
 * Different sensor types we know of.
 */
export enum SensorType {
    temp = "temp",
    hum = "hum"
}

/**
 * Types of watchdog notification and indicates if we should notify based 
 * on WatchdogService.
 */
export enum WatchdogNotification {
    /**
     * Do NOT notify based on watchdog.
     */
    no = "0",
    /**
     * Do notify based on watchdog.
     */
    yes = "1",
    /**
     * Do mute until date/time.
     */
    muted = "2"
}

/**
 * Describes a house where sensors may be placed.
 */
export interface House {
    readonly id : string;
    readonly name : string;
}

/**
 * Describes a device with one or more sensors in a house.
 */
export interface Device {
    readonly house : House;
    readonly id : string;
    readonly name : string;
    readonly notify : WatchdogNotification;
    readonly mutedUntil : Date | undefined;
}

/**
 * Describes a device with status information.
 */
export interface DeviceStatus extends Device {
    dt : Date;
    restarts : number;
    watchdogResets : number;
}

/**
 * Describes a sensor on a device.
 */
export interface Sensor {
    readonly device : Device | null;
    readonly id : string;
    readonly name : string;
    readonly label : string;
    readonly type : SensorType | null;
}

/**
 * Describes a sensor with latest value.
 */
export interface SensorReading extends Sensor {
    readonly value : number;
    readonly value_string : string;
    readonly ageMinutes : number;
    readonly dt : Date;
    readonly dt_string : string;
    readonly denominator : string;
}

/**
 * Type for messages published on the CONTROL topic.
 * 
 */
export interface TopicControlMessage {
    type : ControlMessageTypes;
    device : Device | null;
    deviceId : string;
}

/**
 * Type for messages publushed on the SENSOR topic.
 */
export interface TopicSensorMessage {
    sensor : Sensor | null;
    sensorId : string;
    value : number;
}

/**
 * Type for messages publushed on the DEVICE topic.
 */
export interface TopicDeviceMessage {
    deviceId : string;
    device : Device | null;
}

/**
 * Type for objects with sensor data in Redis.
 */
export interface RedisSensorMessage {
    id : string;
    value : number;
    dt : Date;
}

/**
 * Type for objects with device data in Redis.
 */
export interface RedisDeviceMessage {
    id : string;
    dt : Date;
    restarts : number;
    watchdogResets : number;
}
