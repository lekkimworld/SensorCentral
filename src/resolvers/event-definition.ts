import {
    Arg,
    Ctx,
    Field,
    ID,
    InputType,
    Mutation,
    ObjectType,
    Query,
    Resolver,
    registerEnumType
} from "type-graphql";
import * as types from "../types";

registerEnumType(types.EventTriggerType, {
    name: "EventTriggerType",
    description: "Types of triggers that can fire an event",
});
registerEnumType(types.EventActionType, {
    name: "EventActionType",
    description: "Types of actions that can be executed when an event fires",
});

@ObjectType()
export class EventDefinitionType {
    @Field(() => ID)
    id: string;

    @Field(() => String, { nullable: true })
    userId?: string;

    @Field(() => String, { nullable: true })
    sensorId?: string;

    @Field(() => String, { nullable: true })
    deviceId?: string;

    @Field(() => Boolean)
    active: boolean;

    @Field(() => types.EventTriggerType)
    triggerType: types.EventTriggerType;

    @Field(() => types.EventActionType)
    actionType: types.EventActionType;

    @Field(() => String)
    actionConfig: string;
}

@InputType()
export class CreateEventDefinitionInput {
    @Field(() => String, { nullable: true })
    sensorId?: string;

    @Field(() => String, { nullable: true })
    deviceId?: string;

    @Field(() => types.EventTriggerType)
    triggerType: types.EventTriggerType;

    @Field(() => types.EventActionType)
    actionType: types.EventActionType;

    @Field(() => String, { description: "JSON-encoded action configuration" })
    actionConfig: string;
}

const toGraphQL = (ev: types.EventDefinition): EventDefinitionType => {
    const t = new EventDefinitionType();
    t.id = ev.id;
    t.userId = ev.userId;
    t.sensorId = ev.sensorId;
    t.deviceId = ev.deviceId;
    t.active = ev.active;
    t.triggerType = ev.triggerType;
    t.actionType = ev.actionType;
    t.actionConfig = JSON.stringify(ev.actionConfig);
    return t;
};

@Resolver()
export class EventDefinitionResolver {
    @Query(() => [EventDefinitionType], { description: "Returns event definitions for the specified target" })
    async eventDefinitions(
        @Arg("targetId") targetId: string,
        @Arg("triggerType", () => types.EventTriggerType, { nullable: true }) triggerType: types.EventTriggerType | undefined,
        @Ctx() ctx: types.GraphQLResolverContext
    ): Promise<EventDefinitionType[]> {
        const events = await ctx.storage.getEventDefinitions(ctx.user, targetId, triggerType);
        return events.map(toGraphQL);
    }

    @Mutation(() => EventDefinitionType)
    async createEventDefinition(
        @Ctx() ctx: types.GraphQLResolverContext,
        @Arg("data") input: CreateEventDefinitionInput
    ): Promise<EventDefinitionType> {
        const ev = await ctx.storage.createEventDefinition(ctx.user, {
            sensorId: input.sensorId,
            deviceId: input.deviceId,
            triggerType: input.triggerType,
            actionType: input.actionType,
            actionConfig: JSON.parse(input.actionConfig),
        });
        return toGraphQL(ev);
    }

    @Mutation(() => Boolean)
    async deleteEventDefinition(
        @Ctx() ctx: types.GraphQLResolverContext,
        @Arg("id") id: string
    ): Promise<boolean> {
        return ctx.storage.deleteEventDefinition(ctx.user, id);
    }
}
