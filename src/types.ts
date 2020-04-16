
export class ErrorObject {
    error = true;
    readonly message : string;

    constructor(msg : string, err? : Error) {
        if (err) {
            this.message = `${msg} (${err.message})`;
        } else {
            this.message = msg;
        }
    }
}

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
    //@ts-ignore
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
    dt? : string;
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
    no = 0,
    /**
     * Do notify based on watchdog.
     */
    yes = 1,
    /**
     * Do mute until date/time.
     */
    muted = 2
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
    readonly deviceId : string;
    readonly device : Device | undefined;
    readonly id : string;
    readonly name : string;
    readonly label : string;
    readonly type : SensorType | undefined;
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
    deviceId: string;
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

export interface SensorSample {
    id : string;
    value : number;
    dt : Date;
    dt_string : string;
}

/**
 * Type for objects with sensor data in Redis.
 */
export interface RedisSensorMessage {
    deviceId : string;
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

export interface APIUserContext {
    readonly issuer : string;
    readonly audience : string;
    readonly subject : string;
    readonly scopes : string[];
    readonly houseid : string;
    
    accessAllHouses() : boolean;
    hasScope(scope : string) : boolean;
}

export class HttpException extends Error {
    statusCode: number;
    message: string;
    error?: Error;
    type : string;
  
    constructor(statusCode: number, message: string, error?: Error, type : string = "json") {
      super(message);
  
      this.statusCode = statusCode;
      this.message = message;
      this.error = error;
      this.type = type;
    }
  }
  