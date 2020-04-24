import { Resolver, Query, ObjectType, Field, ID, Arg, Mutation, InputType, Ctx, registerEnumType } from "type-graphql";
import * as types from "../types";
    import { IsEnum, Length } from "class-validator";

/**
 * Register enum.
 * 
 */
registerEnumType(types.WatchdogNotification, {
    "name": "WatchdogNotification", 
    "description": "Notification states - \"yes\", \"no\", \"muted\""
  });

@ObjectType()
class DeviceWatchdog {
    constructor() {

    }
    @Field(() => ID)
    id : string

    @Field()
    @IsEnum(types.WatchdogNotification)
    notify: types.WatchdogNotification;

    @Field({nullable: true})
    muted_until? : Date;
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

@Resolver()
export class DeviceWatchdogResolver {
    
    @Query(() => DeviceWatchdog)
    async deviceWatchdog(@Arg("id") id : string, @Ctx() ctx : types.GraphQLResolverContext) {
            await ctx.storage.getDeviceWatchdog(ctx.user, id);
    }

    @Mutation(() => DeviceWatchdog)
    async updateDeviceWatchdog(@Arg("data") data : WatchdogNotificationInput, @Ctx() context: types.GraphQLResolverContext) {
        await context.storage.updateDeviceWatchdog(context.user, data);
        const device = await context.storage.getDevice(data.id);
        return device;
    }
}

