import { Resolver, Query, ObjectType, Field, ID, Arg, InputType, Mutation, MiddlewareFn, Ctx, UseMiddleware } from "type-graphql";
import * as types from "../types";
import { Length } from "class-validator";
import { User } from "./user";

const FavoriteFetchOnDemand: MiddlewareFn<any> = async ({ root, info, context }, next) => {
    const v = await next();
    if (info.fieldName === "favorite") {
        const house = await context.storage.getFavoriteHouse(context.user);
        if (!house) return false;
        return house.id === root.id;
    } else {
        return v;
    }
};

const IsOwnerFetchOnDemand: MiddlewareFn<any> = async ({ root, info, context }, next) => {
    const v = await next();
    if (info.fieldName === "owner") {
        const rc = await context.storage.isHouseOwner(context.user, context.user.identity.callerId, root.id);
        return rc;
    } else {
        return v;
    }
};

@ObjectType()
class HouseUser extends User {
    readonly owner : boolean;

    constructor(u : types.UserPrincipal, owner : boolean) {
        super(u);
        this.owner = owner;
    }
}

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

    @Field()
    @UseMiddleware(FavoriteFetchOnDemand)
    favorite : boolean;

    @Field()
    @UseMiddleware(IsOwnerFetchOnDemand)
    owner : boolean;
}

@InputType()
export class FavoriteHouseInput {
    @Field(() => ID)
    @Length(1, 36)
    id : string
}

@InputType({description: "Used when granting / revoking access to a House for a number of users"})
export class HouseUsersInput {
    @Field(() => [String])
    ids : []

    @Field()
    houseId : string
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
    @Query(() => [House], { description: "Returns all Houses the user has access to", nullable: false })
    async houses(@Ctx() ctx : types.GraphQLResolverContext) {
        const houses = await ctx.storage.getHouses(ctx.user);
        return houses.map(h => new House(h));
    }

    @Query(() => House!, { description: "Returns the House with the supplied ID" })
    async house(@Arg("id") id : string, @Ctx() ctx : types.GraphQLResolverContext) {
        const house = ctx.storage.getHouse(ctx.user, id);
        return house;
    }

    @Mutation(() => House, {description: "Creates a new House"})
    async createHouse(@Arg("data") data : CreateHouseInput, @Ctx() ctx : types.GraphQLResolverContext) {
        const house = await ctx.storage.createHouse(ctx.user, data);
        return house;
    }

    @Mutation(() => House, {description: "Updates the supplied House"})
    async updateHouse(@Arg("data") data : UpdateHouseInput, @Ctx() ctx : types.GraphQLResolverContext) {
        const house = await ctx.storage.updateHouse(ctx.user, data);
        return house;
    }

    @Mutation(() => House, {description: "Marks the supplied House as the default i.e.  the one shown on login"})
    async favoriteHouse(@Arg("data") data : FavoriteHouseInput, @Ctx() ctx : types.GraphQLResolverContext) {
        const house = await ctx.storage.setFavoriteHouse(ctx.user, data);
        return house;
    }

    @Mutation(() => Boolean, {description: "Deletes the supplied House"})
    async deleteHouse(@Arg("data") data : DeleteHouseInput, @Ctx() ctx : types.GraphQLResolverContext) {
        await ctx.storage.deleteHouse(ctx.user, data);
        return true;
    }

    @Query(() => [HouseUser], { description: "Returns the users with access to the specified house" })
    async houseUsers(@Arg("id") id : string, @Ctx() ctx : types.GraphQLResolverContext) : Promise<HouseUser[]> {
        const users = await ctx.storage.getHouseUsers(ctx.user, id);
        return users.map(u => new HouseUser(u, false));
    }

    @Mutation(() => Boolean, {description: "Grants a user from another House access to the supplied House"})
    async addHouseUsers(@Arg("data") data : HouseUsersInput, @Ctx() ctx : types.GraphQLResolverContext) {
        return ctx.storage.grantHouseAccess(ctx.user, data.houseId, data.ids);
    }

    @Mutation(() => Boolean, {description: "Revokes access for the supplied user to the supplied House"})
    async removeHouseUsers(@Arg("data") data : HouseUsersInput, @Ctx() ctx : types.GraphQLResolverContext) {
        return ctx.storage.revokeHouseAccess(ctx.user, data.houseId, data.ids);
    }
}
