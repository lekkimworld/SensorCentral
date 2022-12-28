import { IsEnum, Length } from "class-validator";
import { Arg, createUnionType, Ctx, Field, FieldResolver, ID, InputType, Mutation, ObjectType, Query, registerEnumType, Resolver, Root } from "type-graphql";
import * as alerts from "../services/alert/alert-types";
import * as types from "../types";
import { Device } from "./device";
import { Sensor } from "./sensor";

const AlertTarget = createUnionType({
  name: 'AlertTarget',
  types: () => [ Sensor, Device ]
});
registerEnumType(alerts.AlertEventType, {
    name: "AlertEventType",
    description: "The types of alert events"
});
registerEnumType(types.NotifyUsing, {
    name: "NotifyUsing",
    description: "Way we can notify",
});

@ObjectType()
export class Alert {
    isTargetSensor: boolean;
    isTargetDevice: boolean;
    constructor(a: alerts.Alert) {
        this.id = a.id;
        this.active = a.active;
        this.description = a.description;
        this.isTargetSensor = "device" in a.target;
        this.isTargetDevice = !this.isTargetSensor;
        this.eventType = a.eventType;
        this.eventData = JSON.stringify(a.eventData);
        this.notifyType =
            types.NotifyUsing.email === a.notifyType
                ? types.NotifyUsing.email
                : types.NotifyUsing.pushover === a.notifyType
                ? types.NotifyUsing.pushover
                : types.NotifyUsing.none;
        this.notifyData = a.notifyData ? JSON.stringify(a.notifyData) : undefined;
        this.target = this.isTargetSensor
            ? new Sensor(a.target as unknown as types.Sensor)
            : new Device(a.target as unknown as types.Device);
    }

    @Field(() => ID)
    id: string;

    @Field()
    active: boolean;

    @Field({ nullable: true })
    @Length(0, 128)
    description: string;

    @Field(() => AlertTarget, { description: "Target of the alert - a Device or a Sensor" })
    target: Sensor | Device;

    @Field(() => alerts.AlertEventType)
    @IsEnum(alerts.AlertEventType)
    eventType: alerts.AlertEventType;

    @Field(() => String)
    eventData: string;

    @Field(() => types.NotifyUsing)
    @IsEnum(types.NotifyUsing)
    notifyType: types.NotifyUsing;

    @Field(() => String, {nullable: true})
    notifyData?: string;
}

@InputType()
export class DeleteAlertInput {
    @Field(() => ID)
    @Length(1, 36)
    id: string;
}

@InputType()
class BaseAlertInput {
    @Field({ nullable: true })
    @Length(0, 128)
    description: string;

    @Field()
    active: boolean;

    @Field(() => String)
    eventData: string;

    @Field(() => types.NotifyUsing)
    @IsEnum(types.NotifyUsing)
    notifyType: types.NotifyUsing;

    @Field(() => String)
    notifyData: string;
}

@InputType()
export class UpdateAlertInput extends BaseAlertInput {
    @Field(() => ID)
    @Length(1, 36)
    id: string;
}

@InputType()
export class CreateAlertInput extends BaseAlertInput {
    @Field(() => String)
    targetId: string;

    @Field(() => Boolean)
    targetIsDevice: boolean;

    @Field(() => alerts.AlertEventType)
    @IsEnum(alerts.AlertEventType)
    eventType: alerts.AlertEventType;
}

@Resolver((_of) => Alert)
export class AlertResolver {
    @Query(() => [Alert], { description: "Returns all alerts for the active user" })
    async alerts(
        @Arg("active", {defaultValue: types.NullableBoolean.yes}) active: types.NullableBoolean, 
        @Arg("targetId", {nullable: true}) targetId: string,
        @Ctx() ctx: types.GraphQLResolverContext) {
        const alerts = await ctx.storage.getAlerts(ctx.user, undefined, active);
        const filteredAlerts = alerts
            .filter(a => !active ? true : types.NullableBoolean.yes === active ? a.active : !a.active)
            .filter(a => targetId ? a.target.id === targetId : true)
        return filteredAlerts.map((a) => new Alert(a));
    }

    @Query(() => Alert!, { description: "Returns the alert with the specified id" })
    async alert(@Arg("id") id: string, @Ctx() ctx: types.GraphQLResolverContext) {
        const alert = await ctx.storage.getAlert(ctx.user, id);
        return new Alert(alert);
    }

    @FieldResolver()
    async target(@Root() alert: Alert, @Ctx() ctx: types.GraphQLResolverContext) : Promise<typeof AlertTarget> {
        if (alert.isTargetSensor) {
            const s = await ctx.storage.getSensor(ctx.user, alert.target.id);
            return new Sensor(s);
        } else {
            const d = await ctx.storage.getDevice(ctx.user, alert.target.id);
            return new Device(d);
        }
    }

    @Mutation(() => Alert)
    async createAlert(@Arg("data") data: CreateAlertInput, @Ctx() ctx: types.GraphQLResolverContext) {
        const alert = await ctx.storage.createAlert(ctx.user, data);
        return new Alert(alert);
    }

    /*
    @Mutation(() => Device)
    async updateDevice(@Arg("data") data: UpdateDeviceInput, @Ctx() ctx: types.GraphQLResolverContext) {
        const device = await ctx.storage.updateDevice(ctx.user, data);
        return new Device(device);
    }
    */

    @Mutation(() => Boolean)
    async deleteAlert(@Arg("data") data: DeleteAlertInput, @Ctx() ctx: types.GraphQLResolverContext) {
        return ctx.storage.deleteAlert(ctx.user, data);
    }
}

