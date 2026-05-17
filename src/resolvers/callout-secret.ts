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
export class CalloutSecret {
    constructor(e: types.CalloutSecret) {
        this.id = e.id;
        this.name = e.name
        this.value = e.value.length < 10 ? "xxxxxxxxxx" : `${e.value.substring(0, e.value.length / 5)}...`;
        this.systemManaged = e.systemManaged ?? false;
    }

    @Field(() => ID)
    id: string;

    @Field(() => String)
    @Length(0, 128)
    name: string;

    @Field(() => String)
    @Length(0, 1024)
    value: string;

    @Field(() => Boolean)
    systemManaged: boolean;
}

@InputType()
export class DeleteCalloutSecretInput {
    @Field(() => ID)
    @Length(1, 36)
    id: string;
}

@InputType()
export class CreateCalloutSecretInput {
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
export class UpdateCalloutSecretInput {
    @Field(() => ID)
    @Length(1, 36)
    id: string;

    @Field(() => String)
    @Length(0, 36)
    name: string;

    @Field(() => String)
    @Length(0, 1024)
    value: string;
}

@Resolver((_of) => CalloutSecret)
export class CalloutSecretResolver {
    @Query(() => [CalloutSecret], {description: "Returns the secrets for the user"})
    async calloutSecrets(@Ctx() ctx: types.GraphQLResolverContext) {
        const secrets = await ctx.storage.getUserCalloutSecrets(ctx.user);
        return secrets.map(s => new CalloutSecret(s));
    }

    @Mutation(() => CalloutSecret)
    async createCalloutSecret(
        @Ctx() ctx: types.GraphQLResolverContext,
        @Arg("data") input: CreateCalloutSecretInput
    ): Promise<CalloutSecret> {
        const s = await ctx.storage.createCalloutSecret(ctx.user, input);
        return new CalloutSecret(s);
    }

    @Mutation(() => CalloutSecret)
    async updateCalloutSecret(
        @Ctx() ctx: types.GraphQLResolverContext,
        @Arg("data") input: UpdateCalloutSecretInput
    ): Promise<CalloutSecret> {
        const s = await ctx.storage.updateCalloutSecret(ctx.user, input);
        return new CalloutSecret(s);
    }

    @Mutation(() => Boolean)
    async deleteCalloutSecret(
        @Ctx() ctx: types.GraphQLResolverContext,
        @Arg("data") input: DeleteCalloutSecretInput
    ): Promise<boolean> {
        await ctx.storage.deleteCalloutSecret(ctx.user, input);
        return true;
    }
}
