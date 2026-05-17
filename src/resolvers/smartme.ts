import { ObjectType, Field } from "type-graphql";
import moment from "moment-timezone";

export class Cloudflare524Error extends Error {
    constructor(msg: string) {
        super(`Cloud Flare specific status 524 error - ${msg}`);
    }
}

export enum PowerUnit {
    "kW",
    "kWh",
    "Unknown",
}
const parsePowerUnit = (str: string): PowerUnit => {
    return str === "kW" ? PowerUnit.kW : str === "kWh" ? PowerUnit.kWh : PowerUnit.Unknown;
};

@ObjectType()
export class SmartmeDeviceWithDataType {
    @Field(() => String) id: string;
    @Field(() => String) name: string;
    @Field(() => Number) serial: number;
    @Field(() => Number) deviceEnergyType: number;
    @Field(() => Number) activePower: number;
    @Field(() => Number) activePowerUnit: PowerUnit;
    @Field(() => Number) counterReading: number;
    @Field(() => Number) counterReadingUnit: PowerUnit;
    @Field(() => Number) counterReadingT1: number;
    @Field(() => Number) counterReadingT2: number;
    @Field(() => Number) counterReadingT3: number;
    @Field(() => Number) counterReadingT4: number;
    @Field(() => Number) counterReadingImport: number;
    @Field(() => Number) counterReadingExport: number;
    @Field(() => Number) voltageL1: number;
    @Field(() => Number) voltageL2: number;
    @Field(() => Number) voltageL3: number;
    @Field(() => Number) currentL1: number;
    @Field(() => Number) currentL2: number;
    @Field(() => Number) currentL3: number;
    @Field(() => Date) valueDate: Date;

    constructor(data: any) {
        this.id = data.Id;
        this.name = data.Name;
        this.serial = data.Serial;
        this.deviceEnergyType = data.DeviceEnergyType;
        this.activePower = data.ActivePower;
        this.activePowerUnit = parsePowerUnit(data.ActivePowerUnit);
        this.counterReading = data.CounterReading;
        this.counterReadingUnit = parsePowerUnit(data.CounterReadingUnit);
        this.counterReadingT1 = data.CounterReadingT1;
        this.counterReadingT2 = data.CounterReadingT2;
        this.counterReadingT3 = data.CounterReadingT3;
        this.counterReadingT4 = data.CounterReadingT4;
        this.counterReadingImport = data.CounterReadingImport;
        this.counterReadingExport = data.CounterReadingExport;
        this.voltageL1 = data.VoltageL1;
        this.voltageL2 = data.VoltageL2;
        this.voltageL3 = data.VoltageL3;
        this.currentL1 = data.CurrentL1;
        this.currentL2 = data.CurrentL2;
        this.currentL3 = data.CurrentL3;
        this.valueDate = moment.utc(data.ValueDate, "YYYY-MM-DDTHH:mm:ss.SSSSSSSZ").toDate();
    }
}
