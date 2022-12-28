import { Resolver, Query, ObjectType, Field, InputType, Ctx, Mutation, Arg } from "type-graphql";
import * as types from "../types";
import { Length } from "class-validator";

@ObjectType()
class Settings {
    constructor(s: types.NotificationSettings) {
        this.pushover_apptoken = s.pushover ? s.pushover.apptoken : undefined;
        this.pushover_userkey = s.pushover ? s.pushover.userkey : undefined;
    }

    @Field({ nullable: true })
    pushover_userkey?: string;

    @Field({ nullable: true })
    pushover_apptoken?: string;
}

@InputType()
export class UpdatePushoverSettingsInput {
    @Field({nullable: true})
    @Length(0, 128)
    pushover_userkey : string;

    @Field({nullable: true})
    @Length(0, 128)
    pushover_apptoken : string;
}

@Resolver((_of) => Settings)
export class SettingsResolver {
    @Query(() => Settings, { description: "Returns the current users settings", nullable: false })
    async settings(@Ctx() ctx: types.GraphQLResolverContext) {
        // get current user
        const user = ctx.user;

        // get users settings
        const s = await ctx.storage.getNotificationSettingsForUser(user);
        return new Settings(s);
    }

    @Mutation(() => Boolean)
    async updateSettings(@Arg("data") data: UpdatePushoverSettingsInput, @Ctx() ctx: types.GraphQLResolverContext) {
        await ctx.storage.updatePushoverSettings(ctx.user, data);
        return true;
    }
}
