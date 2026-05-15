export type HouseUser = Readonly<Partial<{
    id : string;
    fn : string;
    ln : string;
    email : string;
    owner: boolean;
}>>;
type ObjectValues<T> = T[keyof T];

export const HTTP_METHODS = {
    POST: "POST",
    GET: "GET"
};
export type HttpMethod = ObjectValues<typeof HTTP_METHODS>;
export const CONTENT_TYPES = {
    JSON: "JSON",
    FORM: "FORM"
};
export type ContentType = ObjectValues<typeof CONTENT_TYPES>;
export type OnSensorSampleEvent = Readonly<
    Partial<{
        id: string;
        path?: string;
        bodyTemplate?: string;
        method: HttpMethod;
        endpoint: Required<Pick<CalloutEndpoint, "id">>;
        contentType: ContentType;
    }>
>;

export type CalloutEndpoint = Readonly<
    Partial<{
        id: string;
        name: string;
        baseUrl: string;
        bearerToken?: string;
    }>
>;

export type CalloutSecret = Readonly<
    Partial<{
        id: string;
        name: string;
        value: string;
    }>
>;


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
    timeoutSeconds: number;
    sensors: Sensor[];
    house: House;
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
    timeoutSeconds: number;
    device: Device;
    favorite: Boolean;
    last_reading: SensorSample;
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
