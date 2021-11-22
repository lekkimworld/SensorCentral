import { StorageService } from "./services/storage-service";

export interface GraphQLResolverContext {
    readonly storage : StorageService;
    readonly user : BackendIdentity;
}

/**
 * Sources where we can login from/using.
 */
export enum LoginSource {
    google = "google"
}

/**
 * Logged in user identity.
 */
export interface Identity {
    /**
     * Caller ID i.e. our internal user id OR device id if issued for a device 
     * OR * if user have access to all data.
     */
    readonly callerId : string;

    /**
     * The id of the user being impersonated if a 
     * device is contacting the service.
     */
    readonly impersonationId : string | undefined;

    /**
     * Current active house ID OR undefined if user have no houses 
     * OR * if user have access to all houses.
     */
    readonly houseId : string | undefined;
}

export interface NamedPrincipal {
    toString() : string;
    isUser() : boolean;
    isDevice() : boolean;
    isSystem() : boolean;
}
export class UserPrincipal implements NamedPrincipal {
    readonly id : string;
    readonly fn : string;
    readonly ln : string;
    readonly email : string;

    constructor(id : string, fn : string, ln : string, email : string) {
        this.id = id;
        this.fn = fn;
        this.ln = ln;
        this.email = email;
    }

    public isUser() {
        return true;
    }

    public isDevice() {
        return false;
    }

    public isSystem() {
        return false;
    }

    public toString() {
        return `USER - ${this.fn} ${this.ln} (${this.id}, ${this.email})`;
    }
}
export class DevicePrincipal implements NamedPrincipal {
    name : string;

    constructor(name : string) {
        this.name = name;
    }

    public isUser() {
        return false;
    }

    public isDevice() {
        return true;
    }

    public isSystem() {
        return false;
    }

    public toString() {
        return `DEVICE - ${this.name}`;
    }
}
export class SystemPrincipal implements NamedPrincipal {
    name : string;

    constructor(name : string) {
        this.name = name;
    }

    public isUser() {
        return false;
    }

    public isDevice() {
        return false;
    }

    public isSystem() {
        return true;
    }

    public toString() {
        return `SYSTEM - ${this.name}`;
    }
}


export interface BrowserUser {
    readonly id : string;
    readonly fn : string;
    readonly ln : string;
    readonly email : string;
    readonly houseId : string | undefined;
    readonly houses : House[] | undefined;
}
/**
 * Payload sent to browser following a UI login by a user.
 * 
 */
export interface BrowserLoginResponse {
    /**
     * Info about the user i.e. name etc.
     */
    readonly userinfo : BrowserUser;

    /**
     * JWT to use when contacting the backend.
     */
    readonly jwt : string;
}

/**
 * Payload sent to browser when requesting a JWT for a device.
 * 
 */
export interface JWTPayload {
    /**
     * Device specific JWT to use when contacting the backend from a device.
     */
    readonly token : string;
}

/**
 * Represents the identity of the entity calling the backend services 
 * i.e. a user, device or a system account. This object is constructed 
 * by the middleware when a user is authenticated and is set in res.locals.identity.
 */
export interface BackendIdentity {
    readonly identity  : Identity;
    readonly principal : NamedPrincipal;
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
    none = "",
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
    user : UserPrincipal;
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
    readonly favorite : boolean;
    readonly owner : boolean;
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
    readonly scaleFactor : number;
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
  