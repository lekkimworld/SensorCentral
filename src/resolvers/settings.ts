import { Resolver, Query, ObjectType, Field, InputType, Ctx, Mutation, Arg } from "type-graphql";
import * as types from "../types";
import { Length, IsEnum } from "class-validator";

@ObjectType()
class Settings {
    constructor(s : types.NotificationSettings) {
        this.notify_using = s.notifyUsing;
        this.pushover_apptoken = s.pushover ? s.pushover.apptoken : undefined;
        this.pushover_userkey = s.pushover ? s.pushover.userkey : undefined;
    }

    @Field({nullable: true})
    notify_using? : types.NotifyUsing;

    @Field({nullable: true})
    pushover_userkey? : string;

    @Field({nullable: true})
    pushover_apptoken? : string;
}

@InputType()
export class UpdateSettingsInput {
    @Field()
    @IsEnum(types.NotifyUsing)
    notify_using : types.NotifyUsing

    @Field()
    @Length(1, 128)
    pushover_userkey : string;

    @Field()
    @Length(1, 128)
    pushover_apptoken : string;
}

@Resolver()
export class SettingsResolver {
    @Query(() => Settings, { description: "Returns the current users settings", nullable: false })
    async settings(@Ctx() ctx : types.GraphQLResolverContext) {
        // get current user
        const user = ctx.user;

        // get users settings
        const s = await ctx.storage.settings(user);
        return new Settings(s);
    }

    @Mutation(() => Boolean)
    async updateSettings(@Arg("data") data : UpdateSettingsInput, @Ctx() ctx : types.GraphQLResolverContext) {
        await ctx.storage.updateSettings(ctx.user, data);
        return true;
    }
}
