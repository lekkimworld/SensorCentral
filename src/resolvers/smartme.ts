import { Resolver, Query, ObjectType, Field, ID, Arg, InputType, Mutation, Ctx } from "type-graphql";
import * as types from "../types";
import { Length } from "class-validator";

@ObjectType()
export class SmartmeSubscription implements types.SmartmeSubscription {
    constructor(s : types.SmartmeSubscription) {
        this.clientId = s.clientId;
        this.sensorId = s.sensorId;
        this.url = s.url;
    }

    @Field(() => ID)
    clientId : string;

    @Field()
    sensorId : string;

    @Field()
    url : string;
}

@InputType()
export class DeleteSmartmeSubscriptionType {
    @Field(() => ID)
    @Length(2, 36)
    clientId : string;
}

@InputType()
export class CreateSmartmeSubscriptionType extends DeleteSmartmeSubscriptionType {
    @Field()
    @Length(2, 128)
    sensorId : string;

    @Field()
    @Length(2, 128)
    username : string;

    @Field()
    @Length(2, 128)
    password : string;
}

@Resolver()
export class SmartmeResolver {
    @Query(() => [SmartmeSubscription], {})
    async smartmeSubscriptions(@Ctx() ctx : types.GraphQLResolverContext) {
        const subs = await ctx.storage.getSmartmeSubscriptions();
        return subs.map(s => new SmartmeSubscription(s));
    }
    
    @Mutation(() => SmartmeSubscription)
    async createSmartmeSubscription(@Arg("data") data : CreateSmartmeSubscriptionType, @Ctx() ctx : types.GraphQLResolverContext) {
        const sub = await ctx.storage.createSmartmeSubscription(ctx.user, data);
        return new SmartmeSubscription(sub);
    }

    @Mutation(() => Boolean)
    async deleteSmartmeSubscription(@Arg("data") data : DeleteSmartmeSubscriptionType, @Ctx() ctx : types.GraphQLResolverContext) {
        await ctx.storage.deleteSmartmeSubscription(data);
        return true;
    }
}
