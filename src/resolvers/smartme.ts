import { Resolver, ObjectType, Field, Arg, InputType, Query, Mutation, Ctx } from "type-graphql";
import { Length } from "class-validator";
import * as types from "../types";
import constants from "../constants";
import moment from "moment-timezone";
import {generatePayload} from "../smartme-signature";
import { House } from "./house";
import { Sensor } from "./sensor";

export class Cloudflare524Error extends Error {
    constructor(msg : string) {
        super(`Cloud Flare specific status 524 error - ${msg}`);
    }
}

export enum PowerUnit {
    "kW",
    "kWh",
    "Unknown"
}
const parsePowerUnit = (str : string) : PowerUnit => {
    return str === "kW" ? PowerUnit.kW : str === "kWh" ? PowerUnit.kWh : PowerUnit.Unknown
}
const smartmeGetApiUrl = (path:string) : string => {
    const url = `${constants.SMARTME.PROTOCOL}://${constants.SMARTME.DOMAIN}/api${path}`;
    return url;
}
const smartmeGetFetchAttributes = (data : SmartmeCredentialsType) : RequestInit => {
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
export const smartmeVerifyCredentials = async (username:string, password: string) : Promise<boolean> => {
    // get attributes
    const fetch_attrs = smartmeGetFetchAttributes({
        username, password
    });

    // verify the username / password
    let res = await fetch(smartmeGetApiUrl("/User"), fetch_attrs);
    if (res.status === 524) throw new Cloudflare524Error("Error logging in to smart-me");
    if (res.status !== 200) throw new Error("Unable to verify smart-me credentials");
    return true;
}

/**
 * 
 * @param username 
 * @param password 
 * @param sensorId 
 * @returns 
 */
export const smartmeGetDevices = async (username: string, password: string, sensorId? : string) : Promise<undefined | SmartmeDeviceWithDataType[] | SmartmeDeviceWithDataType> => {
        // get attributes
        const fetch_attrs = smartmeGetFetchAttributes({username, password});

        // verify
        await smartmeVerifyCredentials(username, password);

        // get device info
        const url = smartmeGetApiUrl(sensorId ? `/Devices/${sensorId}` : "/Devices");
        const res = await fetch(url, fetch_attrs);
        if (res.status === 524) throw new Cloudflare524Error("Error getting information about a specific smart-me device");
        if (res.status != 200) throw Error(`Unexpected non-200 status code (${res.status})`);
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

@ObjectType()
export class SmartmeEnsureSubscriptionOutputType {
    @Field() houseId: string;
    @Field() sensorId: string;
    @Field({ nullable: true, defaultValue: 1 }) frequency: number;
}

@InputType()
export class SmartmeEnsureSubscriptionInputType {
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
    async smartmeVerifyCredentials(@Arg("data") data: SmartmeCredentialsType): Promise<Boolean> {
        return smartmeVerifyCredentials(data.username, data.password);
    }

    @Query(() => [SmartmeDeviceWithDataType], { nullable: false })
    async smartmeGetDevices(@Arg("data") data: SmartmeCredentialsType) {
        return smartmeGetDevices(data.username, data.password);
    }

    @Mutation(() => SmartmeSubscriptionType, {
        description:
            "Given a house ID will verify the caller has access to the house, then delete all subscriptions for that house, verify that a sensor with the specified ID exists and then create a subscription for the sensor ID with the specified credentials",
    })
    async smartmeEnsureSubscription(
        @Arg("credentials") creds: SmartmeCredentialsType,
        @Arg("subscription") subscription: SmartmeEnsureSubscriptionInputType,
        @Ctx() ctx: types.GraphQLResolverContext
    ) {
        // get house and sensor (throws error if sensor cannot be found) to ensure access
        const sensor = await ctx.storage.getSensor(ctx.user, subscription.sensorId);

        // remove existing subscriptions if any
        await ctx.storage.removePowermeterSubscriptions(ctx.user, sensor.device!.house.id);

        // encrypt credentials
        const payload = generatePayload(creds.username, creds.password, sensor.device!.id, sensor.id);
        await ctx.storage.createPowermeterSubscription(
            ctx.user,
            sensor.device!.house.id,
            sensor.id,
            subscription.frequency,
            payload
        );
        return {
            house: sensor.device!.house,
            sensor,
            frequency: subscription.frequency,
            encryptedCredentials: payload,
        } as SmartmeSubscriptionType;
    }

    @Mutation(() => Boolean, {
        description: "Given a house ID will remove all powermeter subscriptions for that house",
    })
    async smartmeRemoveSubscription(@Arg("houseId") houseId: string, @Ctx() ctx: types.GraphQLResolverContext) {
        // remove existing subscriptions if any (will also check access)
        await ctx.storage.removePowermeterSubscriptions(ctx.user, houseId);
        return true;
    }

    @Query(() => [SmartmeEnsureSubscriptionOutputType], {
        description: "Returns the current subscriptions we have for powermeter data for the houses the user has access to"
    })
    async smartmeGetSubscriptions(@Ctx() ctx : types.GraphQLResolverContext) {
        return (await ctx.storage.getPowermeterSubscriptions(ctx.user)).map((sub) => {
            return {
                sensorId: sub.sensor.id,
                houseId: sub.house.id,
                frequency: sub.frequency
            } as SmartmeEnsureSubscriptionOutputType;
        });
    }

}
