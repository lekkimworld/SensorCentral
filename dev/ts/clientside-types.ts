export type HouseUser = Readonly<Partial<{
    id : string;
    fn : string;
    ln : string;
    email : string;
    owner: boolean;
}>>;
export const ALERT_TYPES = {
    onDeviceTimeout: "onDeviceTimeout",
    onDeviceRestart: "onDeviceRestart",
    onDeviceMessage: "onDeviceMessage",
    onDeviceMessageNoSensor: "onDeviceMessageNoSensor",
    onSensorTimeout: "onSensorTimeout",
    onSensorSample: "onSensorSample",
    onSensorValue: "onSensorValue",
};
type ObjectValues<T> = T[keyof T];
export type AlertType = ObjectValues<typeof ALERT_TYPES>;

export type Alert = Readonly<Partial<{
    id: string;
    active: boolean;
    description: string;
    target: Sensor | Device;
    eventType: AlertType;

    /*
    eventData: string;

    notifyType: types.NotifyUsing;

    notifyData: string;
    */
}>>

export type House = Readonly<
    Partial<{
        id: string;
        name: string;
        favorite: boolean;
        owner: boolean;
        devices: Device[];
        users: HouseUser[];
    }>
>;

export type Device = Readonly<Partial<{
    id: string;
    name: string;
    last_ping: Date;
    last_restart: Date;
    active: boolean;
    sensors: Sensor[];
    house: House;
    alerts: Alert[];
}>>

export type SensorSample = Readonly<Partial<{
    value: number;
    dt: Date;
}>>

export type Sensor = Readonly<Partial<{
    id: string;
    name: string;
    label: string;
    icon: string;
    type: string;
    scaleFactor: number;
    device: Device;
    favorite: Boolean;
    last_reading: SensorSample;
    alerts: Alert[];
}>>

export const SensorType = {
    /**
     * A value that always represents the latest value and that may go up and down.
     */
    gauge: "gauge",

    /**
     * An ever increasing value where deltas can be expressed by subtractig later values 
     * for prior ones.
     */
    counter: "counter",

    /**
     * A value that only represents a change since last value.
     */
    delta: "delta",

    /**
     * Binary on/off sensor
     */
    binary: "binary"
};
