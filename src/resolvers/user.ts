import { Arg, Ctx, Field, ID, ObjectType, Query, Resolver } from "type-graphql";
import * as types from "../types";

@ObjectType()
export class User {
    constructor(u : types.UserPrincipal) {
        this.id = u.id;
        this.fn = u.fn;
        this.ln = u.ln;
        this.email = u.email;
    }
    @Field(() => ID)
    id : string;

    @Field()
    fn : string;

    @Field()
    ln : string;

    @Field(() => String)
    email : string | undefined;
}

@Resolver((_of) => User)
export class UsersResolver {
    @Query(() => User, { description: "Searches for a user", nullable: true })
    async user(@Arg("email", {nullable: true}) email : string, @Arg("id", {nullable: true}) id : string, @Ctx() ctx : types.GraphQLResolverContext) {
        if (!email && !id) return undefined;
        const u = await ctx.storage.getUser(ctx.user, (email || id)!);
        if (!u) return undefined;
        return new User(u);
    }
}
