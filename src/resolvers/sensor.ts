import { Resolver, Query, ObjectType, Field, ID, Arg, InputType, Mutation, Ctx, MiddlewareFn, UseMiddleware, registerEnumType } from "type-graphql";
import * as types from "../types";
import { Device } from "./device";
import { Length, IsEnum } from "class-validator";
import { SensorQueryData, StorageService } from "../services/storage-service";

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

    @Field({nullable: true})
    @Length(2, 36)
    houseId : string;

    @Field(() => types.SensorType, {nullable: true})
    @IsEnum(types.SensorType)
    type : types.SensorType

    @Field(() => [String], {nullable: true})
    sensorIds : string[]
}

@Resolver()
export class SensorResolver {
    @Query(() => [Sensor], {})
    async sensors(@Arg("data") data: SensorsQuery, @Ctx() ctx: types.GraphQLResolverContext) {
        let sensors = await ctx.storage.getSensors(ctx.user, {
            sensorIds: data.sensorIds,
            deviceId: data.deviceId,
            type: data.type,
            houseId: data.houseId,
        } as SensorQueryData);
        return sensors;
    }

    @Query(() => [Sensor], {})
    async sensorsForDevice(@Arg("deviceId") deviceId: string, @Ctx() ctx: types.GraphQLResolverContext) {
        // get device
        const device = await ctx.storage.getDevice(ctx.user, deviceId);

        // get sensors
        const sensors = await ctx.storage.getSensors(ctx.user, {
            "deviceId": device.id
        } as SensorQueryData);

        /*
        // see if this is a powermeter
        if (device.id.match(/[a-z\d]{8}-[a-z\d]{4}-[a-z\d]{4}-[a-z\d]{4}-[a-z\d]{12}/)) {
            // it is - add virtual sensors
            new Array(3).fill(undefined).forEach((_v, idx) => {
                sensors.push({
                    device: device,
                    deviceId: deviceId,
                    id: `${deviceId}__voltagel${idx + 1}`,
                    name: `Voltage - phase ${idx + 1}`,
                    label: `voltage_phase${idx + 1}`,
                    type: types.SensorType.gauge,
                    icon: "battery-4",
                    scaleFactor: 1
                } as types.Sensor);
            });
            new Array(3).fill(undefined).forEach((_v, idx) => {
                sensors.push({
                    device: device,
                    deviceId: deviceId,
                    id: `${deviceId}__currentl${idx + 1}`,
                    name: `Current - phase ${idx + 1}`,
                    label: `current_phase${idx + 1}`,
                    type: types.SensorType.gauge,
                    icon: "battery-4",
                    scaleFactor: 1
                } as types.Sensor);
            });
        }
        */

        // return
        return sensors;
    }

    @Query(() => Sensor, {})
    async sensor(@Arg("id") id: string, @Ctx() ctx: types.GraphQLResolverContext) {
        if (id.indexOf("__") !== -1) {
            // virtual sensor
            const deviceId = id.substring(0, id.indexOf("__"));
            const sensorId = id.substring(id.indexOf("__") + 2);
            const phase = sensorId.indexOf("l1") ? 1 : sensorId.indexOf("l2") ? 2 : 3;
            const device = await ctx.storage.getDevice(ctx.user, deviceId);
            return new Sensor({
                device: device,
                deviceId: deviceId,
                id,
                name: `${sensorId.indexOf("current") !== -1 ? "Current" : "Voltage"} - phase ${phase}`,
                label: `${sensorId.indexOf("current") !== -1 ? "current" : "voltage"}_phase${phase}`,
                type: types.SensorType.gauge,
                icon: "battery-4",
                scaleFactor: 1,
            } as types.Sensor);
        } else {
            const sensor = await ctx.storage.getSensor(ctx.user, id);
            return new Sensor(sensor);
        }
    }

    @Query(() => Sensor, { nullable: true })
    async querySensor(@Arg("label") label: string, @Ctx() ctx: types.GraphQLResolverContext) {
        const sensors = await ctx.storage.getSensors(ctx.user, {
            label,
        } as SensorQueryData);
        if (sensors && Array.isArray(sensors) && sensors.length) {
            return sensors[0];
        } else {
            return undefined;
        }
    }

    @Mutation(() => Sensor)
    async createSensor(@Arg("data") data: CreateSensorType, @Ctx() ctx: types.GraphQLResolverContext) {
        const sensor = await ctx.storage.createSensor(ctx.user, data);
        return sensor;
    }

    @Mutation(() => Sensor)
    async updateSensor(@Arg("data") data: UpdateSensorType, @Ctx() ctx: types.GraphQLResolverContext) {
        const sensor = await ctx.storage.updateSensor(ctx.user, data);
        return sensor;
    }

    @Mutation(() => Boolean)
    async deleteSensor(@Arg("data") data: DeleteSensorType, @Ctx() ctx: types.GraphQLResolverContext) {
        await ctx.storage.deleteSensor(ctx.user, data);
        return true;
    }
}
