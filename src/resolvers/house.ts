import { Resolver, Query, ObjectType, Field, ID, Arg, InputType, Mutation, Ctx } from "type-graphql";
import * as types from "../types";
import { Length } from "class-validator";

@ObjectType()
export class House implements types.House {
    constructor(h : types.House) {
        this.id=h.id;
        this.name=h.name;
    }
    @Field(() => ID)
    id : string;

    @Field()
    name : string;
}

@InputType()
export class CreateHouseInput {
    @Field()
    @Length(1, 128)
    name : string
}

@InputType()
export class UpdateHouseInput extends CreateHouseInput {
    @Field(() => ID)
    @Length(1, 36)
    id : string
}

@InputType()
export class DeleteHouseInput {
    @Field(() => ID)
    @Length(1,36)
    id : string
}

@Resolver()
export class HouseResolver {
    @Query(() => [House], { description: "Returns all Houses", nullable: false })
    async houses(@Ctx() ctx : types.GraphQLResolverContext) {
        const houses = await ctx.storage.getHouses();
        return houses.map(h => new House(h));
    }

    @Query(() => House!, { description: "Returns the House with the supplied ID" })
    async house(@Arg("id") id : string, @Ctx() ctx : types.GraphQLResolverContext) {
        const house = ctx.storage.getHouse(id);
        return house;
    }

    @Mutation(() => House)
    async createHouse(@Arg("data") data : CreateHouseInput, @Ctx() ctx : types.GraphQLResolverContext) {
        const house = await ctx.storage.createHouse(data);
        return house;
    }

    @Mutation(() => House)
    async updateHouse(@Arg("data") data : UpdateHouseInput, @Ctx() ctx : types.GraphQLResolverContext) {
        const house = await ctx.storage.updateHouse(data);
        return house;
    }

    @Mutation(() => Boolean)
    async deleteHouse(@Arg("data") data : DeleteHouseInput, @Ctx() ctx : types.GraphQLResolverContext) {
        await ctx.storage.deleteHouse(data);
        return true;
    }
}
