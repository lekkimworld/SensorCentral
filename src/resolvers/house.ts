import { Resolver, Query, ObjectType, Field, ID, Arg, InputType, Mutation } from "type-graphql";
import * as types from "../types";
import { Length } from "class-validator";
import { StorageService } from "../services/storage-service";
//@ts-ignore
import { lookupService } from "../configure-services";

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
    async houses() {
        const storage = await lookupService("storage") as StorageService;
        const houses = await storage.getHouses();
        return houses.map(h => new House(h));
    }

    @Query(() => House!, { description: "Returns the House with the supplied ID" })
    async house(@Arg("id") id : string) {
        const storage = await lookupService("storage") as StorageService;
        const house = storage.getHouse(id);
        return house;
    }

    @Mutation(() => House)
    async createHouse(@Arg("data") data : CreateHouseInput) {
        const storage = await lookupService("storage") as StorageService;
        const house = await storage.createHouse(data);
        return house;
    }

    @Mutation(() => House)
    async updateHouse(@Arg("data") data : UpdateHouseInput) {
        const storage = await lookupService("storage") as StorageService;
        const house = await storage.updateHouse(data);
        return house;
    }

    @Mutation(() => Boolean)
    async deleteHouse(@Arg("data") data : DeleteHouseInput) {
        const storage = await lookupService("storage") as StorageService;
        await storage.deleteHouse(data);
        return true;
    }
}
