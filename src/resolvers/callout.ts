import { Length } from "class-validator";
import {
    Arg,
    Ctx,
    Field,
    FieldResolver,
    ID,
    InputType,
    Mutation,
    ObjectType,
    Query,
    registerEnumType,
    Resolver,
    Root
} from "type-graphql";
import * as types from "../types";
import { CalloutEndpoint } from "./callout-endpoint";
import { CalloutAuthenticator } from "./callout-authenticator";
import { DeleteInput } from "./common";
import getService from "../services/service-locator";
import CalloutService from "../services/callout-service";

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
        this.contentType = c.contentType;
        this.endpointId = c.endpoint.id;
        this.authenticatorId = c.authenticator?.id;
        this.systemManaged = c.systemManaged ?? false;
    }

    @Field(() => ID)
    id: string;

    @Field(() => String)
    @Length(0, 128)
    name: string;

    @Field(() => types.HttpMethod)
    method: types.HttpMethod;

    @Field(() => String)
    @Length(0, 128)
    pathTemplate: string;

    @Field(() => String, {nullable:true})
    @Length(0, 1024)
    bodyTemplate: string | undefined;

    @Field(() => String, {nullable:true})
    @Length(0, 64)
    contentType: string | undefined;

    @Field(() => Boolean)
    systemManaged: boolean;
}

@InputType()
export class CreateCalloutInput {
    @Field(() => String)
    @Length(1, 128)
    name: string;

    @Field(() => ID)
    endpointId: string;

    @Field(() => types.HttpMethod)
    method: types.HttpMethod;

    @Field(() => ID, { nullable: true })
    authenticatorId?: string;

    @Field(() => String)
    @Length(0, 128)
    pathTemplate: string;

    @Field(() => String, { nullable: true })
    @Length(0, 1024)
    bodyTemplate?: string;

    @Field(() => String, { nullable: true })
    @Length(0, 64)
    contentType?: string;
}

@InputType()
export class UpdateCalloutInput {
    @Field(() => ID)
    id: string;

    @Field(() => String)
    @Length(1, 128)
    name: string;

    @Field(() => ID)
    endpointId: string;

    @Field(() => types.HttpMethod)
    method: types.HttpMethod;

    @Field(() => ID, { nullable: true })
    authenticatorId?: string;

    @Field(() => String)
    @Length(0, 128)
    pathTemplate: string;

    @Field(() => String, { nullable: true })
    @Length(0, 1024)
    bodyTemplate?: string;

    @Field(() => String, { nullable: true })
    @Length(0, 64)
    contentType?: string;
}

@ObjectType()
export class TestResult {
    @Field(() => Boolean)
    success: boolean;

    @Field(() => String)
    message: string;
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

    @Mutation(() => Callout)
    async createCallout(
        @Ctx() ctx: types.GraphQLResolverContext,
        @Arg("data") input: CreateCalloutInput
    ): Promise<Callout> {
        const c = await ctx.storage.createCallout(ctx.user, input);
        return new Callout(c);
    }

    @Mutation(() => Callout)
    async updateCallout(
        @Ctx() ctx: types.GraphQLResolverContext,
        @Arg("data") input: UpdateCalloutInput
    ): Promise<Callout> {
        const c = await ctx.storage.updateCallout(ctx.user, input);
        return new Callout(c);
    }

    @Mutation(() => Boolean)
    async deleteCallout(
        @Ctx() ctx: types.GraphQLResolverContext,
        @Arg("data") input: DeleteInput
    ): Promise<boolean> {
        await ctx.storage.deleteCallout(ctx.user, input);
        return true;
    }

    @Mutation(() => TestResult)
    async testCalloutAuthenticator(
        @Ctx() ctx: types.GraphQLResolverContext,
        @Arg("id") id: string
    ): Promise<TestResult> {
        const svc = getService<CalloutService>(CalloutService.NAME);
        const result = await svc.testAuthenticator(ctx.user, id);
        const t = new TestResult();
        t.success = result.success;
        t.message = result.message;
        return t;
    }

    @Mutation(() => TestResult)
    async testCallout(
        @Ctx() ctx: types.GraphQLResolverContext,
        @Arg("id") id: string
    ): Promise<TestResult> {
        const svc = getService<CalloutService>(CalloutService.NAME);
        const result = await svc.testCallout(ctx.user, id);
        const t = new TestResult();
        t.success = result.success;
        t.message = result.message;
        return t;
    }
}
