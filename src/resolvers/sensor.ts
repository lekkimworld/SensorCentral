import { Resolver, Query, ObjectType, Field, ID, Arg, InputType, Mutation, Ctx, MiddlewareFn, UseMiddleware, registerEnumType } from "type-graphql";
import * as types from "../types";
import { Device } from "./device";
import { Length, IsEnum } from "class-validator";
import { StorageService } from "../services/storage-service";

registerEnumType(types.SensorType, {
    "name": "SensorType",
    "description": "Types of sensors"
})

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
        const samples = await storage.getLastNSamplesForSensor(context.user, root.id, 1);
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
        this.scaleFactor = s.scaleFactor;
    }

    @Field(() => ID)
    id : string;

    @Field()
    name : string;

    @Field()
    label : string;

    @Field()
    icon : string;

    @Field(() => types.SensorType)
    @IsEnum(types.SensorType)
    type : types.SensorType | undefined;

    @Field(() => ID)
    deviceId : string;

    @Field()
    scaleFactor : number;

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

    @Field()
    scaleFactor : number;
}

@InputType()
export class CreateSensorType extends UpdateSensorType {
    @Field(() => ID)
    @Length(2, 36)
    deviceId : string;
}

@InputType()
class SensorsQuery {
    @Field({nullable: true})
    @Length(2, 36)
    deviceId : string;

    @Field(() => types.SensorType, {nullable: true})
    @IsEnum(types.SensorType)
    type : types.SensorType
}

@Resolver()
export class SensorResolver {
    @Query(() => [Sensor], {})
    async sensors(@Arg("data") data : SensorsQuery, @Ctx() ctx : types.GraphQLResolverContext) {
        let sensors;
        if (data.deviceId) {
            sensors = await ctx.storage.getSensors(ctx.user, data.deviceId);
        } else {
            sensors = await ctx.storage.getAllSensors(ctx.user);
        }
        if (data.type) {
            return sensors.filter(s => s.device?.house.id === ctx.user.houseId).filter(s => data && data.type ? s.type === data.type : true).map(s => new Sensor(s));
        } else {
            return sensors;
        }
    }

    @Query(() => Sensor, {})
    async sensor(@Arg("id") id : string, @Ctx() ctx : types.GraphQLResolverContext) {
        const sensor = await ctx.storage.getSensor(ctx.user, id);
        return new Sensor(sensor);
    }

    @Query(() => Sensor, {})
    async querySensor(@Arg("label") label : string, @Ctx() ctx : types.GraphQLResolverContext) {
        const sensor = await ctx.storage.getSensorByLabel(ctx.user, label);
        return new Sensor(sensor);
    }

    @Mutation(() => Sensor)
    async createSensor(@Arg("data") data : CreateSensorType, @Ctx() ctx : types.GraphQLResolverContext) {
        const sensor = await ctx.storage.createSensor(ctx.user, data);
        return sensor;
    }

    @Mutation(() => Sensor)
    async updateSensor(@Arg("data") data : UpdateSensorType, @Ctx() ctx : types.GraphQLResolverContext) {
        const sensor = await ctx.storage.updateSensor(ctx.user, data);
        return sensor;
    }

    @Mutation(() => Boolean)
    async deleteSensor(@Arg("data") data : DeleteSensorType, @Ctx() ctx : types.GraphQLResolverContext) {
        await ctx.storage.deleteSensor(ctx.user, data);
        return true;
    }
}
