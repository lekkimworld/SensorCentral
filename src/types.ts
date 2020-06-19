import { StorageService } from "./services/storage-service";

export interface GraphQLResolverContext {
    readonly storage : StorageService;
    readonly user : BackendLoginUser;
}

/**
 * Sources where we can login from/using.
 */
export enum LoginSource {
    google = "google"
}

/**
 * Logged in user info which may sent to user ie. contains no 
 * sensitive information.
 */
export interface LoginUser {
    /**
     * Our internal userid.
     */
    readonly id : string;

    /**
     * Firstname. Maybe undefined if this is a device commuhicating 
     * with the API using a JWT.
     */
    readonly fn? : string;

    /**
     * Lastname. Maybe undefined if this is a device commuhicating 
     * with the API using a JWT.
     */
    readonly ln? : string;

    /**
     * User email. Maybe undefined if this is a device commuhicating 
     * with the API using a JWT.
     */
    readonly email? : string;
}

/**
 * Payload sent to browser following a UI login by a user.
 * 
 */
export interface BrowserLoginPayload {
    /**
     * Information about the user.
     */
    readonly user : LoginUser;

    /**
     * JWT to use when contacting the backend.
     */
    readonly jwt : string;
}

/**
 * Payload sent to browser when requesting a JWT for a device.
 * 
 */
export interface DeviceJWTPayload {
    /**
     * Device specific JWT to use when contacting the backend from a device.
     */
    readonly token : string;
}

/**
 * Extension of LoginUser to store information required for the 
 * backend.
 */
export interface BackendLoginUser extends LoginUser {
    /**
     * The ID of the house the user may work on/for or "*" if 
     * the user may work with all houses.
     */
    readonly houseId : string;

    /**
     * The scopes that the user has.
     * 
     */
    readonly scopes : string[];
}

/**
 * Pushover settings for a user required when sending a message through 
 * the Pushover service.
 * 
 */
export interface PushoverSettings {
    userkey : string;
    apptoken : string;
}

/**
 * Used when sending a message through the Pushover service.
 * 
 */
export interface PushoverMessage {   
    title : string;
    message : string;
    settings : PushoverSettings;
}

/**
 * The ways we can notify users.
 */
export enum NotifyUsing {
    email = "email",
    pushover = "pushover"
}

/**
 * Notification settings for a user.
 */
export interface NotificationSettings {
    notifyUsing? : NotifyUsing;
    pushover? : PushoverSettings;
}

/**
 * Device watchdog data.
 */
export interface DeviceWatchdog {
    notify : WatchdogNotification;
    mutedUntil? : Date;
}

/**
 * A device watchdog notifier.
 */
export interface DeviceWatchdogNotifier extends DeviceWatchdog{
    user : LoginUser;
    settings : NotificationSettings;
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
    watchdogReset = "watchdogReset",
    noSensorData = "noSensorData"
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
    duration? : number;
    deviceId : string;
    dt? : string;
}

/**
 * Different sensor types we know of.
 */
export enum SensorType {
    /**
     * A value that always represents the latest value and that may go up and down.
     */
    gauge = "gauge",

    /**
     * An ever increasing value where deltas can be expressed by subtractig later values 
     * for prior ones.
     */
    counter = "counter",

    /**
     * A value that only represents a change since last value.
     */
    delta = "delta"
}

/**
 * Types of watchdog notification and indicates if we should notify based 
 * on WatchdogService.
 */
export enum WatchdogNotification {
    /**
     * Do NOT notify based on watchdog.
     */
    no = "no",
    /**
     * Do notify based on watchdog.
     */
    yes = "yes",
    /**
     * Do mute until date/time.
     */
    muted = "muted"
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
    readonly lastRestart : Date;
    readonly lastWatchdogReset : Date;
    readonly lastPing : Date;
    readonly active : boolean;
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
    readonly icon : string;
}

/**
 * Describes a sensor with latest value.
 */
export interface SensorReading extends Sensor {
    readonly value : number;
    readonly value_string : string;
    readonly ageMinutes : number;
    readonly dt : Date;
    readonly denominator : string;
}

/**
 * Type for messages published on the CONTROL topic.
 * 
 */
export interface TopicControlMessage {
    type : ControlMessageTypes;
    device? : Device;
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

/**
 * Sensor samples read from the database.
 * 
 */
export interface SensorSample {
    id : string;
    value : number;
    dt : Date;
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
  