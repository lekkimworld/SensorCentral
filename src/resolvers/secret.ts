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
export class Secret {
    constructor(e: types.Secret) {
        this.id = e.id;
        this.name = e.name
        this.value = e.value.length < 10 ? "xxxxxxxxxx" : `${e.value.substring(0, e.value.length / 5)}...`;
    }

    @Field(() => ID)
    id: string;

    @Field()
    @Length(0, 128)
    name: string;

    @Field()
    @Length(0, 1024)
    value: string;
}

@InputType()
export class DeleteSecretInput {
    @Field(() => ID)
    @Length(1, 36)
    id: string;
}

@InputType()
export class CreateSecretInput {
    @Field(() => String, {
        description: "The name of the secret",
    })
    @Length(0, 36)
    name: string;

    @Field(() => String, {
        description: "The value of the secret.",
    })
    @Length(0, 1024)
    value: string;
}

@InputType()
export class UpdateSecretInput {
    @Field(() => ID)
    @Length(1, 36)
    id: string;

    @Field()
    @Length(0, 36)
    name: string;

    @Field()
    @Length(0, 1024)
    value: string;
}

@Resolver((_of) => Secret)
export class SecretResolver {
    @Query(() => [Secret], {description: "Returns the secrets for the user"})
    async secrets(@Ctx() ctx: types.GraphQLResolverContext) {
        const secrets = await ctx.storage.getUserSecrets(ctx.user);
        return secrets.map(s => new Secret(s));
    }

    @Mutation(() => Secret)
    async createSecret(
        @Ctx() ctx: types.GraphQLResolverContext,
        @Arg("data") input: CreateSecretInput
    ): Promise<Secret> {
        const s = await ctx.storage.createSecret(ctx.user, input);
        return new Secret(s);
    }

    @Mutation(() => Secret)
    async updateSecret(
        @Ctx() ctx: types.GraphQLResolverContext,
        @Arg("data") input: UpdateSecretInput
    ): Promise<Secret> {
        const s = await ctx.storage.updateSecret(ctx.user, input);
        return new Secret(s);
    }

    @Mutation(() => Boolean)
    async deleteSecret(
        @Ctx() ctx: types.GraphQLResolverContext,
        @Arg("data") input: DeleteSecretInput
    ): Promise<boolean> {
        await ctx.storage.deleteSecret(ctx.user, input);
        return true;
    }
}
