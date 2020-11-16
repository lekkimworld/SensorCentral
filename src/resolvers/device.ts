import { Resolver, Query, ObjectType, Field, ID, Arg, Mutation, InputType, Ctx } from "type-graphql";
import * as types from "../types";
import { Length } from "class-validator";
import { House } from "./house";

@ObjectType()
export class Device {
    constructor(d : types.Device) {
        this.id = d.id;
        this.name = d.name;
        this.house = d.house;
        this.active = d.active;
        this.last_ping = d.lastPing;
        this.last_restart = d.lastRestart;
        this.last_watchdog_reset = d.lastWatchdogReset;
    }

    @Field(() => ID)
    id : string;

    @Field()
    name : string;

    @Field({nullable: true})
    last_ping : Date;

    @Field({nullable: true})
    last_restart : Date;

    @Field({nullable: true})
    last_watchdog_reset : Date;

    @Field()
    house : House;

    @Field()
    active : boolean;
}

@InputType()
export class DeleteDeviceInput {
    @Field(() => ID)
    @Length(1,36)
    id : string
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

@Resolver()
export class DeviceResolver {
    @Query(() => [Device], {description: "Returns all devices for the house with the specified houseId"})
    async devices(@Arg("houseId") houseId : string, @Ctx() ctx : types.GraphQLResolverContext) {
        const devices = await ctx.storage.getDevices(ctx.user, houseId);
        return devices.map(d => new Device(d));
    }

    @Query(() => Device!, {description: "Returns the device with the specified id"})
    async device(@Arg("id") id : string, @Ctx() ctx : types.GraphQLResolverContext) {
        const device = await ctx.storage.getDevice(ctx.user, id);
        return new Device(device);
    }
    
    @Mutation(() => Device)
    async createDevice(@Arg("data") data : CreateDeviceInput, @Ctx() ctx : types.GraphQLResolverContext) {
        const device = await ctx.storage.createDevice(ctx.user, data);
        return new Device(device);
    }

    @Mutation(() => Device)
    async updateDevice(@Arg("data") data : UpdateDeviceInput, @Ctx() ctx : types.GraphQLResolverContext) {
        const device = await ctx.storage.updateDevice(ctx.user, data);
        return new Device(device);
    }

    @Mutation(() => Boolean)
    async deleteDevice(@Arg("data") data : DeleteDeviceInput, @Ctx() ctx : types.GraphQLResolverContext) {
        await ctx.storage.deleteDevice(ctx.user, data);
        return true;
    }
}

