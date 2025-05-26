import { AuthenticatorTemplate, templates } from "../callout-authenticator-templates/templates";
import { Length } from "class-validator";
import {
    Ctx,
    Field,
    ID,
    ObjectType,
    Query,
    Resolver
} from "type-graphql";
import * as types from "../types";

@ObjectType()
export class CalloutAuthenticatorTemplate {
    constructor(e: types.CalloutAuthenticatorTemplate) {
        this.id = e.id;
        this.name = e.name
        this.placeholders = Object.keys(e.placeholders).map(key => {
            const description = e.placeholders[key];
            return new CalloutAuthenticatorTemplatePlaceholder(key, description);
        })
    }

    @Field(() => ID)
    id: string;

    @Field()
    @Length(0, 128)
    name: string;

    @Field(() => [CalloutAuthenticatorTemplatePlaceholder])
    placeholders: Array<CalloutAuthenticatorTemplatePlaceholder>;

}

@ObjectType()
export class CalloutAuthenticatorTemplatePlaceholder {
    constructor(name: string, description: string) {
        this.name = name
        this.description = description;
    }

    @Field()
    name: string;

    @Field()
    description: string;

}

@Resolver((_of) => CalloutAuthenticatorTemplate)
export class CalloutAuthenticatorTemplateResolver {
    @Query(() => [CalloutAuthenticatorTemplate], {description: "Returns the authentication templates available"})
    async calloutAuthenticatorTemplates(@Ctx() _ctx: types.GraphQLResolverContext) {
        return Object.keys(templates).map(key => {
            const templ : types.CalloutAuthenticatorTemplate = templates[key as AuthenticatorTemplate];
            return new CalloutAuthenticatorTemplate(templ);
        })
    }
}
