import { Length } from "class-validator";
import {
    Ctx,
    Field,
    FieldResolver,
    ID,
    InputType,
    ObjectType,
    Query,
    registerEnumType,
    Resolver,
    Root
} from "type-graphql";
import * as types from "../types";
import e from "express";
import { CalloutEndpoint } from "./callout-endpoint";
import { CalloutAuthenticator } from "./callout-authenticator";

registerEnumType(types.HttpMethod, {
    name: "HttpMethod",
    description: "The HTTP methods supported",
});

@ObjectType()
export class Callout {
    endpointId: string;
    authenticatorId: string | undefined;

    constructor(c: types.Callout) {
        this.id = c.id;
        this.name = c.name
        this.method = c.method;
        this.pathTemplate = c.pathTemplate;
        this.bodyTemplate = c.bodyTemplate;
        this.endpointId = c.endpoint.id;
        this.authenticatorId = c.authenticator?.id;
    }

    @Field(() => ID)
    id: string;

    @Field()
    @Length(0, 128)
    name: string;

    @Field()
    method: types.HttpMethod;

    @Field()
    @Length(0, 128)
    pathTemplate: string;

    @Field(() => String, {nullable:true})
    @Length(0, 1024)
    bodyTemplate: string | undefined;
}

@InputType()
export class CreateCalloutInput {
    @Field(() => ID, {description: "The id of the callout"})
    id: string;

    @Field(() => String, {description: "The name of the callout"})
    @Length(0, 36)
    name: string;
}

@InputType()
export class UpdateCalloutInput {
    @Field(() => ID)
    @Length(1, 36)
    id: string;

    @Field()
    @Length(0, 36)
    name: string;
}

@Resolver((_of) => Callout)
export class CalloutResolver {
    @Query(() => [Callout], {description: "Returns the callouts for the user"})
    async callouts(@Ctx() ctx: types.GraphQLResolverContext) {
        const callouts = await ctx.storage.getUserCallouts(ctx.user);
        return callouts.map(c => new Callout(c));
        
    }

    @FieldResolver(() => CalloutEndpoint)
    async endpoint(@Root() callout: Callout, @Ctx() ctx: types.GraphQLResolverContext) {
        const endpoint = (await ctx.storage.getCalloutEndpoints(ctx.user)).find(e => e.id === callout.endpointId)!;
        return new CalloutEndpoint(endpoint);
    }

    @FieldResolver(() => CalloutAuthenticator, {nullable: true})
    async authenticator(@Root() callout: Callout, @Ctx() ctx: types.GraphQLResolverContext) {
        const auth = (await ctx.storage.getCalloutAuthenticators(ctx.user)).find(a => a.id === callout.authenticatorId);
        if (auth) return new CalloutAuthenticator(auth);
        return undefined;
    }
/*
    @Mutation(() => Callout)
    async createCallout(
        @Ctx() ctx: types.GraphQLResolverContext,
        @Arg("data") input: CreateCalloutInput
    ): Promise<CalloutAuthenticator> {
        const a = await ctx.storage.createCalloutAuthenticator(ctx.user, input);
        return new Callout(a);
    }

    @Mutation(() => Callout)
    async updateCallout(
        @Ctx() ctx: types.GraphQLResolverContext,
        @Arg("data") input: UpdateCalloutInput
    ): Promise<Callout> {
        const a = await ctx.storage.updateCallout(ctx.user, input);
        return new Callout(a);
    }

    @Mutation(() => Boolean)
    async deleteCallout(
        @Ctx() ctx: types.GraphQLResolverContext,
        @Arg("data") input: DeleteInput
    ): Promise<boolean> {
        await ctx.storage.deleteCallout(ctx.user, input);
        return true;
    }
        */
}
