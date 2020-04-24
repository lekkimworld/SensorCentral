import { Resolver, Query, ObjectType, Field, ID, Arg, Mutation, InputType, Ctx } from "type-graphql";
import * as types from "../types";
import { Length } from "class-validator";
import { House } from "./house";

/**
 * GraphQL middleware function to load last ping from Redis when requested only.
 * 
 * @param param0 
 * @param next 
 */
/*
const LastpingFetchOnDemand: MiddlewareFn<any> = async ({ root, info }, next) => {
    const v = await next();
    if (info.fieldName === "lastping") {
        const storage = await lookupService("storage") as StorageService;
        const statuses = await storage.getKnownDevicesStatus();
        const filtered = statuses.filter(s => s.id === root.id);
        //@ts-ignore
        if (filtered.length) return filtered[0].ageMinutes;
        return undefined;
    } else {
        return v;
    }
};
*/

@ObjectType()
export class Device implements types.Device {
    constructor(d : types.Device) {
        this.id = d.id;
        this.name = d.name;
        this.house = d.house;
    }

    @Field(() => ID)
    id : string;

    @Field()
    name : string;

    @Field()
    house : House;
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
        const devices = await ctx.storage.getDevices(houseId);
        return devices.map(d => new Device(d));
    }

    @Query(() => Device!, {description: "Returns the device with the specified id"})
    async device(@Arg("id") id : string, @Ctx() ctx : types.GraphQLResolverContext) {
        const device = await ctx.storage.getDevice(id);
        return device;
    }
    
    @Mutation(() => Device)
    async createDevice(@Arg("data") data : CreateDeviceInput, @Ctx() ctx : types.GraphQLResolverContext) {
        const device = await ctx.storage.createDevice(data);
        return device;
    }

    @Mutation(() => Device)
    async updateDevice(@Arg("data") data : UpdateDeviceInput, @Ctx() ctx : types.GraphQLResolverContext) {
        const device = await ctx.storage.updateDevice(data);
        return device;
    }

    @Mutation(() => Boolean)
    async deleteDevice(@Arg("data") data : DeleteDeviceInput, @Ctx() ctx : types.GraphQLResolverContext) {
        await ctx.storage.deleteDevice(data);
        return true;
    }
}

