import { Resolver, Query, Ctx, Mutation, Arg, InputType, Field } from "type-graphql";
import { Sensor } from "./sensor";
import { GraphQLResolverContext, SensorType } from "../types";
import { IsEnum } from "class-validator";

@InputType()
export class FavoriteSensorsInput {
    @Field()
    @IsEnum(SensorType)
    type : SensorType
}


@Resolver()
export class FavoriteSensorResolver {
    @Query(() => [Sensor])
    async favoriteSensors(@Arg("data", {nullable: true}) data : FavoriteSensorsInput, @Ctx() context : GraphQLResolverContext) {
        const sensors = await context.storage.getFavoriteSensors(context.user, data);
        return sensors;
    }

    @Mutation(() => Boolean)
    async addFavoriteSensor(@Arg("id") id : string, @Ctx() context : GraphQLResolverContext) {
        await context.storage.addFavoriteSensor(context.user, id);
        return true;
    }

    @Mutation(() => Boolean)
    async removeFavoriteSensor(@Arg("id") id : string, @Ctx() context : GraphQLResolverContext) {
        await context.storage.removeFavoriteSensor(context.user, id);
        return true;
    }

}
