import { Resolver, Query, ObjectType, Field, ID, Arg, InputType, Mutation, Ctx } from "type-graphql";
import * as types from "../types";
import { Device } from "./device";
import { Length, IsEnum } from "class-validator";

@ObjectType()
class Sensor implements types.Sensor {
    constructor(s : types.Sensor) {
        this.id = s.id;
        this.name = s.name;
        this.label = s.label;
        this.type = s.type;
        this.deviceId = s.deviceId;
        this.device = s.device;
    }

    @Field(() => ID)
    id : string;

    @Field()
    name : string;

    @Field()
    label : string;

    @Field(() => String)
    type : types.SensorType | undefined;

    @Field(() => ID)
    deviceId : string;

    @Field(() => Device)
    device : types.Device | undefined;
}

@InputType()
export class DeleteSensorType {
    @Field(() => ID)
    @Length(2, 36)
    id : string;
}

@InputType()
export class UpdateSensorType extends DeleteSensorType {
    @Field()
    @Length(2, 128)
    label : string;

    @Field()
    @Length(2, 128)
    name : string;

    @Field()
    @IsEnum(types.SensorType)
    type : types.SensorType;
}

@InputType()
export class CreateSensorType extends UpdateSensorType {
    @Field(() => ID)
    @Length(2, 36)
    deviceId : string;
}


@Resolver()
export class SensorResolver {
    @Query(() => [Sensor], {})
    async sensors(@Arg("deviceId") deviceId : string, @Ctx() ctx : types.GraphQLResolverContext) {
        const sensors = await ctx.storage.getSensors(deviceId);
        return sensors.map(s => new Sensor(s));
    }

    @Query(() => Sensor, {})
    async sensor(@Arg("id") id : string, @Ctx() ctx : types.GraphQLResolverContext) {
        const sensor = await ctx.storage.getSensor(id);
        return new Sensor(sensor);
    }

    @Mutation(() => Sensor)
    async createSensor(@Arg("data") data : CreateSensorType, @Ctx() ctx : types.GraphQLResolverContext) {
        const sensor = await ctx.storage.createSensor(data);
        return sensor;
    }

    @Mutation(() => Sensor)
    async updateSensor(@Arg("data") data : UpdateSensorType, @Ctx() ctx : types.GraphQLResolverContext) {
        const sensor = await ctx.storage.updateSensor(data);
        return sensor;
    }

    @Mutation(() => Boolean)
    async deleteSensor(@Arg("data") data : DeleteSensorType, @Ctx() ctx : types.GraphQLResolverContext) {
        await ctx.storage.deleteSensor(data);
        return true;
    }
}