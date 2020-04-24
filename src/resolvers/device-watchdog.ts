import { Resolver, ObjectType, Field, ID, InputType, FieldResolver, Root, registerEnumType, Ctx, Mutation, Arg } from "type-graphql";
import * as types from "../types";
import { IsEnum, Length } from "class-validator";
import { Device } from "./device";
import { formatDate } from "..//utils";

/**
 * Register enum.
 * 
 */
registerEnumType(types.WatchdogNotification, {
    "name": "WatchdogNotification", 
    "description": "Notification states - \"yes\", \"no\", \"muted\""
});

@ObjectType()
export class DeviceWatchdog {
    constructor(wd : types.DeviceWatchdog) {
        this.notify = wd.notify;
        this.muted_until = wd.mutedUntil;
        this.str_muted_until = wd.mutedUntil ? formatDate(wd.mutedUntil) : "";
    }

    @Field()
    @IsEnum(types.WatchdogNotification)
    notify: types.WatchdogNotification;

    @Field({nullable: true})
    muted_until? : Date;

    @Field()
    str_muted_until : string;
}

@InputType()
export class WatchdogNotificationInput {
    @Field(() => ID)
    @Length(1,36)
    id : string
    
    @Field({description: "One of \"yes\", \"no\", \"muted\""})
    @IsEnum(types.WatchdogNotification)
    notify: types.WatchdogNotification;
}

@Resolver(() => Device)
export class DeviceWatchdogResolver {

    @FieldResolver(() => DeviceWatchdog)
    async watchdog(@Ctx() context : types.GraphQLResolverContext, @Root() root : any) {
        const wd = await context.storage.getDeviceWatchdog(context.user, root.id);
        return new DeviceWatchdog(wd);
        
    }
    
    @Mutation(() => Device)
    async updateDeviceWatchdog(@Arg("data") data : WatchdogNotificationInput, @Ctx() context: types.GraphQLResolverContext) {
        await context.storage.updateDeviceWatchdog(context.user, data);
        const device = await context.storage.getDevice(data.id);
        return device;
    }
}

