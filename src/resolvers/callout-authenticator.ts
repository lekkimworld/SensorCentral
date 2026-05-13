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
    registerEnumType,
    Resolver,
    Root
} from "type-graphql";
import { AuthenticatorTemplate } from "../callout-authenticator-templates/templates";
import * as types from "../types";
import { CalloutEndpoint } from "./callout-endpoint";
import { DeleteInput } from "./common";
import { CalloutSecret } from "./callout-secret";

registerEnumType(AuthenticatorTemplate, {
    name: "AuthenticatorTemplate",
    description: "The authenticator templates that are supported",
});

@ObjectType()
export class CalloutAuthenticatorTemplateMapping {
    constructor(name: string, secret: CalloutSecret) {
        this.name = name;
        this.secret = secret;
    }

    @Field(() => String)
    name: string;

    @Field(() => CalloutSecret)
    secret: CalloutSecret;

}

@InputType()
export class CalloutAuthenticatorTemplateMappingInput {
    constructor(name: string, secretId: string) {
        this.name = name;
        this.secretId = secretId;
    }

    @Field(() => String)
    name: string;

    @Field(() => String)
    secretId: string;

}

@ObjectType()
export class CalloutAuthenticator {
    endpointId: string;

    constructor(e: types.CalloutAuthenticator) {
        this.id = e.id;
        this.name = e.name;
        this.endpointId = e.endpoint.id;
        this.template = e.template;
        this.templateMappings = Object.keys(e.templateMappings).map(key => new CalloutAuthenticatorTemplateMapping(key, e.templateMappings[key]));
    }

    @Field(() => ID)
    id: string;

    @Field(() => String)
    @Length(0, 128)
    name: string;

    @Field(() => AuthenticatorTemplate)
    template: AuthenticatorTemplate;

    @Field(() => [CalloutAuthenticatorTemplateMapping])
    templateMappings: Array<CalloutAuthenticatorTemplateMapping>;
}

@InputType()
export class CreateCalloutAuthenticatorInput {
    @Field(() => String, {description: "The name of the authenticator"})
    @Length(0, 36)
    name: string;

    @Field(() => String)
    endpointId: string;

    @Field(() => AuthenticatorTemplate)
    template: AuthenticatorTemplate;

    @Field(() => [CalloutAuthenticatorTemplateMappingInput])
    templateMappings: Array<CalloutAuthenticatorTemplateMappingInput>;
}

@InputType()
export class UpdateCalloutAuthenticatorInput {
    @Field(() => ID)
    @Length(1, 36)
    id: string;

    @Field(() => String)
    @Length(0, 36)
    name: string;
}

@Resolver((_of) => CalloutAuthenticator)
export class CalloutAuthenticatorResolver {
    @Query(() => [CalloutAuthenticator], {description: "Returns the authenticators on the for the user"})
    async calloutAuthenticators(@Ctx() ctx: types.GraphQLResolverContext) {
        const auths = await ctx.storage.getCalloutAuthenticators(ctx.user);
        return auths.map(a => new CalloutAuthenticator(a));
    }

    @FieldResolver(() => CalloutEndpoint)
    async endpoint(@Root() auth: CalloutAuthenticator, @Ctx() ctx: types.GraphQLResolverContext) {
        const endpoint = (await ctx.storage.getCalloutEndpoints(ctx.user)).find(e => e.id === auth.endpointId)!;
        return new CalloutEndpoint(endpoint);
    }

    @Mutation(() => CalloutAuthenticator)
    async createCalloutAuthenticator(
        @Ctx() ctx: types.GraphQLResolverContext,
        @Arg("data") input: CreateCalloutAuthenticatorInput
    ): Promise<CalloutAuthenticator> {
        const a = await ctx.storage.createCalloutAuthenticator(ctx.user, input);
        return new CalloutAuthenticator(a);
    }

    @Mutation(() => CalloutAuthenticator)
    async updateCalloutSecret(
        @Ctx() ctx: types.GraphQLResolverContext,
        @Arg("data") input: UpdateCalloutAuthenticatorInput
    ): Promise<CalloutAuthenticator> {
        const a = await ctx.storage.updateCalloutAuthenticator(ctx.user, input);
        return new CalloutAuthenticator(a);
    }

    @Mutation(() => Boolean)
    async deleteCalloutAuthenticator(
        @Ctx() ctx: types.GraphQLResolverContext,
        @Arg("data") input: DeleteInput
    ): Promise<boolean> {
        await ctx.storage.deleteCalloutAuthenticator(ctx.user, input);
        return true;
    }
}
