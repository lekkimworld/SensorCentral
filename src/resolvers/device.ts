import { Length } from "class-validator";
import { Arg, Ctx, Field, FieldResolver, ID, InputType, Mutation, ObjectType, Query, registerEnumType, Resolver, Root } from "type-graphql";
import * as types from "../types";
import { Alert } from "./alert";
import { House } from "./house";
import { Sensor } from "./sensor";
import * as alert_types from "../services/alert/alert-types";

registerEnumType(types.NullableBoolean, {
    name: "NullableBoolean",
    description: "Boolean that may be null",
});

@ObjectType()
export class Device {
    storageDevice: types.Device;
    houseId: string;
    constructor(d: types.Device) {
        this.storageDevice = d;
        this.houseId = d.house.id;
        this.id = d.id;
        this.name = d.name;
        this.active = d.active;
        this.last_ping = d.lastPing;
        this.last_restart = d.lastRestart;
    }

    @Field(() => ID)
    id: string;

    @Field()
    name: string;

    @Field({ nullable: true })
    last_ping: Date;

    @Field({ nullable: true })
    last_restart: Date;

    @Field()
    active: boolean;

    @Field(() => [Sensor])
    sensors: types.Sensor[];

    @Field(() => House)
    house: types.House;

    @Field(() => [Alert])
    alerts: alert_types.Alert[];
}

@ObjectType()
class DeviceData {
    @Field(() => ID)
    id: string;
    @Field({ nullable: true })
    dt?: string;
    @Field({ nullable: true })
    ip?: string;

    constructor(id: string, data?: types.DeviceData) {
        this.id = id;
        if (data) {
            this.dt = data.str_dt;
            this.ip = data.data.ip;
        }
    }
}

@InputType()
export class DeleteDeviceInput {
    @Field(() => ID)
    @Length(1, 36)
    id: string;
}

@InputType()
export class UpdateDeviceInput extends DeleteDeviceInput {
    @Field()
    @Length(2, 128)
    name : string

    @Field()
    active : boolean
}

@InputType()
export class CreateDeviceInput extends UpdateDeviceInput{
    @Field(() => ID)
    @Length(2, 36)
    houseId : string
}

@Resolver((_of) => Device)
export class DeviceResolver {
    @Query(() => [Device], { description: "Returns all devices for the house with the specified houseId" })
    async devices(@Arg("houseId") houseId: string, @Ctx() ctx: types.GraphQLResolverContext) {
        const devices = await ctx.storage.getDevices(ctx.user, houseId);
        return devices.map((d) => new Device(d));
    }

    @Query(() => Device!, { description: "Returns the device with the specified id" })
    async device(@Arg("id") id: string, @Ctx() ctx: types.GraphQLResolverContext) {
        const device = await ctx.storage.getDevice(ctx.user, id);
        return new Device(device);
    }

    @FieldResolver()
    async house(@Root() device: Device, @Ctx() ctx: types.GraphQLResolverContext): Promise<House> {
        const house = await ctx.storage.getHouse(ctx.user, device.houseId);
        return new House(house);
    }

    @FieldResolver()
    async sensors(@Root() device: Device, @Ctx() ctx: types.GraphQLResolverContext) {
        const sensors = await ctx.storage.getSensors(ctx.user, { deviceId: device.id });
        return sensors.map((s) => new Sensor(s));
    }

    @FieldResolver()
    async alerts(
        @Arg("active", () => types.NullableBoolean, { nullable: true }) active: types.NullableBoolean,
        @Root() device: Device,
        @Ctx() ctx: types.GraphQLResolverContext
    ): Promise<Alert[]> {
        return (await ctx.storage.getAlerts(ctx.user, device.storageDevice, active)).map((a) => new Alert(a));
    }

    @Query(() => DeviceData, { description: "Returns device data for the device with the specified id if any" })
    async deviceData(@Arg("id") id: string, @Ctx() ctx: types.GraphQLResolverContext) {
        const data = await ctx.storage.getDeviceData(id);
        return new DeviceData(id, data);
    }

    @Mutation(() => Device)
    async createDevice(@Arg("data") data: CreateDeviceInput, @Ctx() ctx: types.GraphQLResolverContext) {
        const device = await ctx.storage.createDevice(ctx.user, data);
        return new Device(device);
    }

    @Mutation(() => Device)
    async updateDevice(@Arg("data") data: UpdateDeviceInput, @Ctx() ctx: types.GraphQLResolverContext) {
        const device = await ctx.storage.updateDevice(ctx.user, data);
        return new Device(device);
    }

    @Mutation(() => Boolean)
    async deleteDevice(@Arg("data") data: DeleteDeviceInput, @Ctx() ctx: types.GraphQLResolverContext) {
        await ctx.storage.deleteDevice(ctx.user, data);
        return true;
    }
}

