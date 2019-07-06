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
    type : ControlMessageTypes | null;
    deviceId : string;
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

export enum SensorType {
    temp = "temp",
    hum = "hum"
}

export interface House {
    readonly id : string;
    readonly name : string;
}

export interface Device {
    readonly house : House;
    readonly id : string;
    readonly name : string;
}

export interface DeviceStatus extends Device {
    restarts : number;
    watchdogResets : number;
}

export interface Sensor {
    readonly device : Device | null;
    readonly id : string;
    readonly name : string;
    readonly label : string;
    readonly type : SensorType | null;
}

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

export interface RedisDeviceMessage {
    id : string;
    restarts : number;
    watchdogResets : number;
}
