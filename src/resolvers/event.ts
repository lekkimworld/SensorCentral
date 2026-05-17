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
    Resolver,
    Root,
    registerEnumType
} from "type-graphql";
import * as types from "../types";
import { CalloutEndpoint } from "./callout-endpoint";
import { DeleteInput } from "./common";

registerEnumType(types.HttpMethod, {
    name: "HttpMethod",
    description: "Different HTTP verbs supported for outbound calls",
});
registerEnumType(types.ContentType, {
    name: "ContentType",
    description: "Different HTTP Content-Types supported for outbound calls",
});

@ObjectType()
export class OnSensorSampleEvent {
    constructor(e: types.OnSensorSampleEvent) {
        this.id = e.id;
        this.method = e.method;
        this.path = e.path;
        this.bodyTemplate = e.bodyTemplate;
        this.endpointId = e.endpoint.id;
        this.contentType = e.contenttype;
    }

    @Field(() => ID)
    id: string;

    endpointId: string;

    @Field(() => types.HttpMethod)
    method: types.HttpMethod;

    @Field(() => String, {nullable: true})
    @Length(0, 128)
    path?: string;

    @Field(() => types.ContentType)
    contentType: types.ContentType;

    @Field(() => String, {nullable: true})
    @Length(0, 1024)
    bodyTemplate?: string;

    @Field(() => CalloutEndpoint)
    endpoint: CalloutEndpoint;
}

@InputType()
export class CreateOnSensorSampleEventInput {
    @Field(() => String, {
        nullable: true,
        description:
            "The path to send the request to. The path allows for substitutions using a %%key%% format.",
    })
    @Length(0, 128)
    path: string;

    @Field(() => String, {
        nullable: true,
        description:
            "The template of the request body being sent on POST requests. The template allows for substitutions using a %%key%% format.",
    })
    @Length(0, 1024)
    bodyTemplate: string;

    @Field(() => types.HttpMethod)
    method: types.HttpMethod;

    @Field(() => String)
    sensorId: string;

    @Field(() => String)
    endpointId: string;

    @Field(() => types.ContentType)
    contentType: types.ContentType;
}

@InputType()
export class UpdateOnSensorSampleEventInput {
    @Field(() => ID)
    @Length(1, 36)
    id: string;

    @Field(() => types.HttpMethod, { nullable: true })
    method: types.HttpMethod;

    @Field(() => String, { nullable: true })
    path: string;

    @Field(() => String, { nullable: true })
    bodyTemplate: string;

    @Field(() => types.ContentType, { nullable: true })
    contentType: types.ContentType;
}

@Resolver((_of) => OnSensorSampleEvent)
export class EventResolver {
    @Query(() => [OnSensorSampleEvent], {description: "Returns onSensorSample event definitions for the supplied sensror ID"})
    async events(@Arg("sensorId") sensorId: string, @Ctx() ctx: types.GraphQLResolverContext) {
        const events = await ctx.storage.getUserOnSensorSampleEvents(ctx.user, sensorId);
        return events.map((e) => new OnSensorSampleEvent(e));
    }

    @FieldResolver()
    async endpoint(@Root() event: OnSensorSampleEvent, @Ctx() ctx: types.GraphQLResolverContext): Promise<CalloutEndpoint> {
        const ep = (await ctx.storage.getCalloutEndpoints(ctx.user)).find((e) => e.id === event.endpointId)!;
        return new CalloutEndpoint(ep);
    }

    @Mutation(() => OnSensorSampleEvent)
    async createEvent(
        @Ctx() ctx: types.GraphQLResolverContext,
        @Arg("data") input: CreateOnSensorSampleEventInput
    ): Promise<OnSensorSampleEvent> {
        const ev = await ctx.storage.createOnSensorSampleEvent(ctx.user, input);
        return new OnSensorSampleEvent(ev);
    }

    @Mutation(() => OnSensorSampleEvent)
    async updateEvent(
        @Ctx() ctx: types.GraphQLResolverContext,
        @Arg("data") input: UpdateOnSensorSampleEventInput
    ): Promise<OnSensorSampleEvent> {
        const ev = await ctx.storage.updateOnSensorSampleEvent(ctx.user, input);
        return new OnSensorSampleEvent(ev);
    }

    @Mutation(() => Boolean)
    async deleteEvent(
        @Ctx() ctx: types.GraphQLResolverContext,
        @Arg("data") input: DeleteInput
    ): Promise<boolean> {
        await ctx.storage.deleteOnSensorSampleEvent(ctx.user, input);
        return true;
    }
}
