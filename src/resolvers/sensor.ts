import { IsEnum, Length } from "class-validator";
import { Arg, Ctx, Field, FieldResolver, ID, InputType, Mutation, ObjectType, Query, registerEnumType, Resolver, Root } from "type-graphql";
import * as alert_types from "../services/alert/alert-types";
import { SensorQueryData } from "../services/storage-service";
import * as types from "../types";
import { Alert } from "./alert";
import { Device } from "./device";
import { OnSensorSampleEvent } from "./event";

registerEnumType(types.SensorType, {
    "name": "SensorType",
    "description": "Types of sensors"
})

registerEnumType(types.NullableBoolean, {
    name: "NullableBoolean",
    description: "Boolean that may be null",
});

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
export class Sensor {
    storageSensor: types.Sensor;
    deviceId: string;
    constructor(s: types.Sensor) {
        this.storageSensor = s;
        this.deviceId = s.device?.id || s.deviceId;

        this.id = s.id;
        this.name = s.name;
        this.label = s.label;
        this.type = s.type;
        this.icon = s.icon;
        this.scaleFactor = s.scaleFactor;
    }

    @Field(() => ID)
    id: string;

    @Field()
    name: string;

    @Field({ nullable: true })
    label?: string;

    @Field()
    icon: string;

    @Field(() => types.SensorType)
    @IsEnum(types.SensorType)
    type: types.SensorType | undefined;

    @Field()
    scaleFactor: number;

    @Field(() => Device)
    device: types.Device;

    @Field()
    favorite: Boolean;

    @Field({ nullable: true })
    last_reading: SensorSample;

    @Field(() => [Alert])
    alerts: alert_types.Alert[];

    @Field(() => [OnSensorSampleEvent])
    events: OnSensorSampleEvent[];
}

@InputType()
export class DeleteSensorType {
    @Field(() => ID)
    @Length(2, 36)
    id : string;
}

@InputType()
export class UpdateSensorType extends DeleteSensorType {
    @Field({nullable: true})
    @Length(0, 128)
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

    @Field(() => types.NullableBoolean, {nullable: true})
    @IsEnum(types.NullableBoolean)
    favorite: types.NullableBoolean
}

@InputType()
export class FavoriteSensorsInput {
    @Field()
    @IsEnum(types.SensorType)
    type: types.SensorType;
}

@Resolver((_of) => Sensor)
export class SensorResolver {
    @Query(() => [Sensor], {})
    async sensors(
        @Arg("data", { nullable: true, defaultValue: {} }) data: SensorsQuery,
        @Ctx() ctx: types.GraphQLResolverContext
    ) {
        let sensors = await ctx.storage.getSensors(ctx.user, {
            sensorIds: data.sensorIds,
            deviceId: data.deviceId,
            type: data.type,
            houseId: data.houseId,
            favorite: data.favorite,
        } as SensorQueryData);
        return sensors.map((s) => new Sensor(s));
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

    @FieldResolver()
    async favorite(@Root() sensor: Sensor, @Ctx() ctx: types.GraphQLResolverContext): Promise<boolean> {
        const sensors = await ctx.storage.getFavoriteSensors(ctx.user);
        const filtered = sensors.filter((s: types.Sensor) => s.id === sensor.id);
        return filtered.length !== 0;
    }

    @FieldResolver()
    async last_reading(
        @Root() sensor: Sensor,
        @Ctx() ctx: types.GraphQLResolverContext
    ): Promise<SensorSample | undefined> {
        const samples = await ctx.storage.getLastNSamplesForSensor(ctx.user, sensor.id, 1);
        return !samples || samples.length === 0 ? undefined : new SensorSample(samples[0]);
    }

    @FieldResolver()
    async alerts(
        @Arg("active", () => types.NullableBoolean, { nullable: true }) active: types.NullableBoolean,
        @Root() sensor: Sensor,
        @Ctx() ctx: types.GraphQLResolverContext
    ): Promise<Alert[]> {
        return (await ctx.storage.getAlerts(ctx.user, sensor.storageSensor, active)).map((a) => new Alert(a));
    }

    @FieldResolver()
    async events(
        @Root() sensor: Sensor,
        @Ctx() ctx: types.GraphQLResolverContext
    ): Promise<OnSensorSampleEvent[]> {
        return (await ctx.storage.getUserOnSensorSampleEvents(ctx.user, sensor.id)).map((e) => new OnSensorSampleEvent(e));
    }

    @FieldResolver()
    async device(@Root() sensor: Sensor, @Ctx() ctx: types.GraphQLResolverContext): Promise<Device> {
        return new Device(await ctx.storage.getDevice(ctx.user, sensor.deviceId));
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

    @Mutation(() => Boolean)
    async addFavoriteSensor(@Arg("id") id: string, @Ctx() ctx: types.GraphQLResolverContext) {
        await ctx.storage.addFavoriteSensor(ctx.user, id);
        return true;
    }

    @Mutation(() => Boolean)
    async removeFavoriteSensor(@Arg("id") id: string, @Ctx() ctx: types.GraphQLResolverContext) {
        await ctx.storage.removeFavoriteSensor(ctx.user, id);
        return true;
    }
}
