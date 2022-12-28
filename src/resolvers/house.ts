import { Length } from "class-validator";
import { Arg, Ctx, Field, FieldResolver, ID, InputType, Mutation, ObjectType, Query, registerEnumType, Resolver, Root } from "type-graphql";
import * as types from "../types";
import { Device } from "./device";
import { User } from "./user";

registerEnumType(types.NullableBoolean, {
    name: "NullableBoolean",
    description: "Boolean that may be null",
});

@ObjectType()
class HouseUser extends User {
    @Field()
    owner : boolean;

    constructor(u : types.UserPrincipal, owner : boolean) {
        super(u);
        this.owner = owner;
    }
}

@ObjectType()
export class House implements types.House {
    constructor(h: types.House) {
        this.id = h.id;
        this.name = h.name;
    }
    @Field(() => ID)
    id: string;

    @Field()
    name: string;

    @Field()
    favorite: boolean;

    @Field()
    owner: boolean;

    @Field(() => [Device])
    devices: types.Device[];

    @Field(() => [HouseUser])
    users: types.HouseUser[];
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

@Resolver((_of) => House)
export class HouseResolver {
    @Query((_returns) => [House], { description: "Returns all Houses the user has access to", nullable: false })
    async houses(@Ctx() ctx: types.GraphQLResolverContext) {
        const houses = await ctx.storage.getHouses(ctx.user);
        return houses.map((h) => new House(h));
    }
    
    @Query((_returns) => House!, { description: "Returns the House with the supplied ID" })
    async house(@Arg("id") id: string, @Ctx() ctx: types.GraphQLResolverContext) {
        const house = await ctx.storage.getHouse(ctx.user, id);
        return new House(house);
    }

    @FieldResolver((_type) => [Device])
    async devices(
        @Arg("active", { defaultValue: types.NullableBoolean.yes, nullable: true }) active: types.NullableBoolean,
        @Root() house: House,
        @Ctx() ctx: types.GraphQLResolverContext
    ) {
        return (await ctx.storage.getDevices(ctx.user, house.id))
            .filter((d) => !active ? true : active === types.NullableBoolean.yes ? d.active : !d.active)
            .map((d) => new Device(d));
    }

    @FieldResolver((_type) => [HouseUser], { description: "Returns the users with access to the specified house" })
    async users(@Root() house: House, @Ctx() ctx: types.GraphQLResolverContext): Promise<HouseUser[]> {
        const users = await ctx.storage.getHouseUsers(ctx.user, house.id);
        return users.map((u) => new HouseUser(u, u.owner));
    }

    @FieldResolver(() => Boolean)
    async owner(@Root() house : House, @Ctx() ctx: types.GraphQLResolverContext) : Promise<boolean> {
        return ctx.storage.isHouseOwner(ctx.user, ctx.user.identity.callerId, house.id);
    }

    @FieldResolver(() => Boolean)
    async favorite(@Root() house : House, @Ctx() ctx : types.GraphQLResolverContext) : Promise<boolean> {
        const favhouse = await ctx.storage.getFavoriteHouse(ctx.user);
        if (!favhouse) return false;
        return favhouse.id === house.id;
    }


    @Mutation(() => House, { description: "Creates a new House" })
    async createHouse(@Arg("data") data: CreateHouseInput, @Ctx() ctx: types.GraphQLResolverContext) {
        const house = await ctx.storage.createHouse(ctx.user, data);
        return house;
    }

    @Mutation(() => House, { description: "Updates the supplied House" })
    async updateHouse(@Arg("data") data: UpdateHouseInput, @Ctx() ctx: types.GraphQLResolverContext) {
        const house = await ctx.storage.updateHouse(ctx.user, data);
        return new House(house);
    }

    @Mutation(() => Boolean, { description: "Deletes the supplied House" })
    async deleteHouse(@Arg("data") data: DeleteHouseInput, @Ctx() ctx: types.GraphQLResolverContext) {
        await ctx.storage.deleteHouse(ctx.user, data);
        return true;
    }

    @Mutation(() => House, { description: "Marks the supplied House as the default i.e.  the one shown on login" })
    async favoriteHouse(@Arg("data") data: FavoriteHouseInput, @Ctx() ctx: types.GraphQLResolverContext) {
        const house = await ctx.storage.setFavoriteHouse(ctx.user, data);
        return new House(house);
    }

    @Mutation(() => Boolean, { description: "Grants a user from another House access to the supplied House" })
    async addHouseUsers(@Arg("data") data: HouseUsersInput, @Ctx() ctx: types.GraphQLResolverContext) {
        return ctx.storage.grantHouseAccess(ctx.user, data.houseId, data.ids);
    }

    @Mutation(() => Boolean, { description: "Revokes access for the supplied user to the supplied House" })
    async removeHouseUsers(@Arg("data") data: HouseUsersInput, @Ctx() ctx: types.GraphQLResolverContext) {
        return ctx.storage.revokeHouseAccess(ctx.user, data.houseId, data.ids);
    }
}
