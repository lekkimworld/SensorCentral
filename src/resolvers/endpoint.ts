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
export class Endpoint {
    constructor(e: types.Endpoint) {
        this.id = e.id;
        this.name = e.name;
        this.baseUrl = e.baseUrl;
        this.bearerToken = e.bearerToken;
    }

    @Field(() => ID)
    id: string;

    @Field()
    @Length(1, 128)
    name: string;

    @Field()
    @Length(15, 128)
    baseUrl: string;

    @Field()
    @Length(1, 1024)
    bearerToken?: string;
}

@InputType()
export class DeleteEndpointInput {
    @Field(() => ID)
    @Length(1, 36)
    id: string;
}

@InputType()
export class CreateEndpointInput {
    @Field({ nullable: false })
    @Length(1, 128)
    name: string;

    @Field(() => String, { nullable: false })
    @Length(15, 128)
    baseUrl: string;

    @Field(() => String, { nullable: true })
    @Length(0, 1024)
    bearerToken: string;
}

@InputType()
export class UpdateEndpointInput {
    @Field(() => ID)
    @Length(1, 36)
    id: string;

    @Field({ nullable: true})
    name: string;

    @Field({ nullable: true})
    baseUrl: string;

    @Field({ nullable: true })
    bearerToken: string;
}

@Resolver((_of) => Endpoint)
export class EndpointResolver {
    @Query(() => [Endpoint], { description: "Returns all endpoints for the active user" })
    async endpoints(@Ctx() ctx: types.GraphQLResolverContext) {
        const endpoints = await ctx.storage.getEndpoints(ctx.user);
        return endpoints.map((e) => {
            return new Endpoint(e);
        });
    }

    @Mutation(() => Endpoint, { description: "Creates and endpoint for the active user" })
    async createEndpoint(@Arg("data") data: CreateEndpointInput, @Ctx() ctx: types.GraphQLResolverContext) {
        const e = await ctx.storage.createEndpoint(ctx.user, data);
        return new Endpoint(e);
    }

    @Mutation(() => Endpoint, { description: "Updates an endpoints for the active user" })
    async updateEndpoint(@Arg("data") data: UpdateEndpointInput, @Ctx() ctx: types.GraphQLResolverContext) {
        const e = await ctx.storage.updateEndpoint(ctx.user, data);
        return new Endpoint(e);
    }

    @Mutation(() => Boolean, { description: "Deletes an endpoint for the active user" })
    async deleteEndpoint(@Arg("data") data: DeleteEndpointInput, @Ctx() ctx: types.GraphQLResolverContext) {
        await ctx.storage.deleteEndpoint(ctx.user, data);
        return true;
    }
}
