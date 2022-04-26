import { Resolver, ObjectType, Field, Arg, InputType, Query, Mutation, Ctx } from "type-graphql";
import { Length } from "class-validator";
import * as types from "../types";
import constants from "../constants";
import fetch, { RequestInit } from "node-fetch";
import moment from "moment-timezone";
import {generatePayload} from "../smartme-signature";
import { House } from "./house";
import { Sensor } from "./sensor";

enum PowerUnit {
    "kW",
    "kWh",
    "Unknown"
}
const parsePowerUnit = (str : string) : PowerUnit => {
    return str === "kW" ? PowerUnit.kW : str === "kWh" ? PowerUnit.kWh : PowerUnit.Unknown
}
const getSmartmeApiUrl = (path:string) : string => {
    const url = `${constants.SMARTME.PROTOCOL}://${constants.SMARTME.DOMAIN}/api${path}`;
    return url;
}
const getSmartmeFetchAttributes = (data : SmartmeCredentialsType) : RequestInit => {
    // calc auth header
    const basic_auth = Buffer.from(`${data.username}:${data.password}`).toString("base64");
    const headers = {
        Authorization: `Basic ${basic_auth}`,
        Accept: "application/json",
    };
    const fetch_attrs = {
        method: "get",
        headers,
    };
    return fetch_attrs;
}
export const verifySmartmeCredentials = async (username:string, password: string) : Promise<boolean> => {
    // get attributes
    const fetch_attrs = getSmartmeFetchAttributes({
        username, password
    });

    // verify the username / password
    let res = await fetch(getSmartmeApiUrl("/Account/login"), fetch_attrs);
    if (res.status !== 200) throw Error("Unable to verify smart-me credentials");
    return true;
}
export const getSmartmeDevices = async (username: string, password: string, sensorId? : string) : Promise<undefined | SmartmeDeviceWithDataType[] | SmartmeDeviceWithDataType> => {
        // get attributes
        const fetch_attrs = getSmartmeFetchAttributes({username, password});

        // verify
        await verifySmartmeCredentials(username, password);

        // get device info
        const res = await fetch(getSmartmeApiUrl(sensorId ? `/Devices/${sensorId}` : "/Devices"), fetch_attrs);
        const resultData = await res.json();
        if (!resultData) {
            return undefined;
        } else if (Array.isArray(resultData)) {
            return resultData.map((d: any) => {
                return new SmartmeDeviceWithDataType(d);
            });
        } else {
            return new SmartmeDeviceWithDataType(resultData);
        }
        
    }

@ObjectType()
export class SmartmeDeviceWithDataType {
    @Field() id: string;
    @Field() name: string;
    @Field() serial: number;
    @Field() deviceEnergyType: number;
    @Field() activePower: number;
    @Field() activePowerUnit: PowerUnit;
    @Field() counterReading: number;
    @Field() counterReadingUnit: PowerUnit;
    @Field() counterReadingT1: number;
    @Field() counterReadingT2: number;
    @Field() counterReadingT3: number;
    @Field() counterReadingT4: number;
    @Field() counterReadingImport: number;
    @Field() counterReadingExport: number;
    @Field() voltageL1: number;
    @Field() voltageL2: number;
    @Field() voltageL3: number;
    @Field() currentL1: number;
    @Field() currentL2: number;
    @Field() currentL3: number;
    @Field() valueDate: Date;

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

@InputType()
export class EnsureSmartmeSubscriptionType {
    @Field() houseId: string;
    @Field() sensorId: string;
    @Field({nullable: true, defaultValue: 1}) frequency: number;
}

@ObjectType()
export class SmartmeSubscriptionType implements types.SmartmeSubscription {
    @Field() house : House;
    @Field() sensor : Sensor;
    @Field() frequency : number;
    @Field() encryptedCredentials: string;
}

@InputType()
export class SmartmeCredentialsType {
    @Field()
    @Length(2, 128)
    username: string;

    @Field()
    @Length(2, 128)
    password: string;
}

@Resolver()
export class SmartmeResolver {
    @Query(() => Boolean, {})
    async verifySmartmeCredentials(@Arg("data") data: SmartmeCredentialsType): Promise<Boolean> {
        return verifySmartmeCredentials(data.username, data.password);
    }

    @Query(() => [SmartmeDeviceWithDataType], { nullable: false })
    async getSmartmeDevices(@Arg("data") data: SmartmeCredentialsType) {
        return getSmartmeDevices(data.username, data.password);
    }

    @Mutation(() => SmartmeSubscriptionType, { description: "Given a house ID will verify the caller has access to the house, then delete all subscriptions for that house, verify that a sensor with the specified ID exists and then create a subscription for the sensor ID with the specified credentials" })
    async ensureSmartmeSubscription(
        @Arg("credentials") creds: SmartmeCredentialsType,
        @Arg("subscription") subscription: EnsureSmartmeSubscriptionType,
        @Ctx() ctx: types.GraphQLResolverContext
    ) {
        // get house and sensor to ensure access
        const house = await ctx.storage.getHouse(ctx.user, subscription.houseId);
        const sensor = await ctx.storage.getSensor(ctx.user, subscription.sensorId);

        // remove existing subscriptions if any
        await ctx.storage.removePowermeterSubscriptions(ctx.user, house.id);

        // encrypt credentials
        const payload = generatePayload(creds.username, creds.password);
        await ctx.storage.createPowermeterSubscription(ctx.user, house.id, sensor.id, subscription.frequency, payload);
        return {
            house: new House(house), 
            sensor: new Sensor(sensor),
            frequency: subscription.frequency,
            encryptedCredentials: payload
        } as SmartmeSubscriptionType;
    }
}
