import { Resolver, Query, ObjectType, Field, ID, Arg, InputType, Mutation, Ctx, MiddlewareFn, UseMiddleware } from "type-graphql";
import * as types from "../types";
import { Device } from "./device";
import { Length, IsEnum } from "class-validator";
import { StorageService } from "../services/storage-service";

const FavoriteFetchOnDemand: MiddlewareFn<any> = async ({ root, info, context }, next) => {
    const v = await next();
    if (info.fieldName === "favorite") {
        const sensors = await context.storage.getFavoriteSensors(context.user);
        const filtered = sensors.filter((s : types.Sensor) => s.id === root.id);
        return filtered.length !== 0;
    } else {
        return v;
    }
};

const LastReadingFetchOnDemand: MiddlewareFn<any> = async ({ root, info, context }, next) => {
    const v = await next();
    if (info.fieldName === "last_reading") {
        const storage = context.storage as StorageService;
        const samples = await storage.getLastNSamplesForSensor(root.id, 1);
        return !samples || samples.length === 0 ? undefined : new SensorSample(samples[0]);
    } else {
        return v;
    }
};

@ObjectType()
class SensorSample {
    constructor(s : types.SensorSample) {
        this.value = Math.round(s.value * 10) / 10;
        this.dt = s.dt;
    }

    @Field()
    value : number;

    @Field()
    dt : Date;
}

@ObjectType()
export class Sensor implements types.Sensor {
    constructor(s : types.Sensor) {
        this.id = s.id;
        this.name = s.name;
        this.label = s.label;
        this.type = s.type;
        this.icon = s.icon;
        this.deviceId = s.deviceId;
        this.device = s.device;
    }

    @Field(() => ID)
    id : string;

    @Field()
    name : string;

    @Field()
    label : string;

    @Field()
    icon : string;

    @Field(() => String)
    type : types.SensorType | undefined;

    @Field(() => ID)
    deviceId : string;

    @Field(() => Device)
    device : types.Device | undefined;

    @Field()
    @UseMiddleware(FavoriteFetchOnDemand)
    favorite : Boolean;

    @Field({nullable: true})
    @UseMiddleware(LastReadingFetchOnDemand)
    last_reading : SensorSample;
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

    @Field()
    icon : string;
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

    @Query(() => Sensor, {})
    async querySensor(@Arg("label") label : string, @Ctx() ctx : types.GraphQLResolverContext) {
        const sensor = await ctx.storage.getSensorByLabel(label);
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
