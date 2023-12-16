import { Field, ID, ObjectType } from "type-graphql";
import { DataElement, Dataset } from "../types";

@ObjectType()
export class GraphQLDataset implements Dataset {
    constructor(id: string, name: string | undefined) {
        this.id = id;
        this.name = name;
        this.data = [];
        this.fromCache = false;
    }

    @Field(() => ID)
    id: string;

    @Field(() => String, { nullable: true })
    name: string | undefined;

    @Field(() => Boolean, { nullable: false })
    fromCache: boolean;

    @Field(() => [GraphQLDataElement])
    data: DataElement[];
}

@ObjectType()
export class GraphQLDataElement implements DataElement {
    constructor(x: string, y: number) {
        this.x = x;
        this.y = y;
    }

    @Field()
    x: string;

    @Field()
    y: number;
}
