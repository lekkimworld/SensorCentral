import { Length } from "class-validator";
import {
    Field,
    ID,
    InputType
} from "type-graphql";

@InputType()
export class DeleteInput {
    @Field(() => ID)
    @Length(1, 36)
    id: string;
}