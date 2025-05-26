import { Length } from "class-validator";
import {
    Arg,
    Ctx,
    Field,
    ID,
    InputType,
    Mutation,
    ObjectType,
    Query,
    Resolver
} from "type-graphql";
import * as types from "../types";

@ObjectType()
export class CalloutEndpoint {
    constructor(e: types.CalloutEndpoint) {
        this.id = e.id;
        this.name = e.name;
        this.baseUrl = e.baseUrl;
    }

    @Field(() => ID)
    id: string;

    @Field()
    @Length(1, 128)
    name: string;

    @Field()
    @Length(15, 128)
    baseUrl: string;
}

@InputType()
export class DeleteCalloutEndpointInput {
    @Field(() => ID)
    @Length(1, 36)
    id: string;
}

@InputType()
export class CreateCalloutEndpointInput {
    @Field({ nullable: false })
    @Length(1, 128)
    name: string;

    @Field(() => String, { nullable: false })
    @Length(15, 128)
    baseUrl: string;
}

@InputType()
export class UpdateCalloutEndpointInput {
    @Field(() => ID)
    @Length(1, 36)
    id: string;

    @Field({ nullable: true})
    name: string;

    @Field({ nullable: true})
    baseUrl: string;
}

@Resolver((_of) => CalloutEndpoint)
export class CalloutEndpointResolver {
    @Query(() => [CalloutEndpoint], { description: "Returns all endpoints for the active user" })
    async calloutEndpoints(@Ctx() ctx: types.GraphQLResolverContext) {
        const endpoints = await ctx.storage.getCalloutEndpoints(ctx.user);
        return endpoints.map((e) => {
            return new CalloutEndpoint(e);
        });
    }

    @Mutation(() => CalloutEndpoint, { description: "Creates and endpoint for the active user" })
    async createCalloutEndpoint(@Arg("data") data: CreateCalloutEndpointInput, @Ctx() ctx: types.GraphQLResolverContext) {
        const e = await ctx.storage.createCalloutEndpoint(ctx.user, data);
        return new CalloutEndpoint(e);
    }

    @Mutation(() => CalloutEndpoint, { description: "Updates an endpoints for the active user" })
    async updateCalloutEndpoint(@Arg("data") data: UpdateCalloutEndpointInput, @Ctx() ctx: types.GraphQLResolverContext) {
        const e = await ctx.storage.updateCalloutEndpoint(ctx.user, data);
        return new CalloutEndpoint(e);
    }

    @Mutation(() => Boolean, { description: "Deletes an endpoint for the active user" })
    async deleteCalloutEndpoint(@Arg("data") data: DeleteCalloutEndpointInput, @Ctx() ctx: types.GraphQLResolverContext) {
        await ctx.storage.deleteCalloutEndpoint(ctx.user, data);
        return true;
    }
}
