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
import { Endpoint } from "./endpoint";

registerEnumType(types.HttpMethod, {
    name: "HttpMethod",
    description: "Different HTTP verbs supported for outbound calls",
});

@ObjectType()
export class OnSensorSampleEvent {
    constructor(e: types.OnSensorSampleEvent) {
        this.id = e.id;
        this.method = e.method;
        this.path = e.path;
        this.bodyTemplate = e.bodyTemplate;
        this.endpointId = e.endpoint.id;
    }

    @Field(() => ID)
    id: string;

    endpointId: string;

    @Field(() => types.HttpMethod)
    method: types.HttpMethod;

    @Field({nullable: true})
    @Length(0, 128)
    path?: string;

    @Field({nullable: true})
    @Length(0, 1024)
    bodyTemplate?: string;

    @Field()
    endpoint: Endpoint;
}

@InputType()
export class DeleteOnSensorSampleEventInput {
    @Field(() => ID)
    @Length(1, 36)
    id: string;
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

    @Field()
    sensorId: string;

    @Field()
    endpointId: string;
}

@InputType()
export class UpdateOnSensorSampleEventInput {
    @Field(() => ID)
    @Length(1, 36)
    id: string;

    @Field(() => types.HttpMethod, { nullable: true })
    method: types.HttpMethod;

    @Field({ nullable: true })
    path: string;

    @Field({ nullable: true })
    bodyTemplate: string;
}

@Resolver((_of) => OnSensorSampleEvent)
export class EventResolver {
    @Query(() => [OnSensorSampleEvent], {description: "Returns onSensorSample event definitions for the supplied sensror ID"})
    async events(@Arg("sensorId") sensorId: string, @Ctx() ctx: types.GraphQLResolverContext) {
        const events = await ctx.storage.getUserOnSensorSampleEvents(ctx.user, sensorId);
        return events.map((e) => new OnSensorSampleEvent(e));
    }

    @FieldResolver()
    async endpoint(@Root() event: OnSensorSampleEvent, @Ctx() ctx: types.GraphQLResolverContext): Promise<Endpoint> {
        return (await ctx.storage.getEndpoints(ctx.user)).find((e) => e.id === event.endpointId)!;
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
        @Arg("data") input: DeleteOnSensorSampleEventInput
    ): Promise<boolean> {
        await ctx.storage.deleteOnSensorSampleEvent(ctx.user, input);
        return true;
    }
}
