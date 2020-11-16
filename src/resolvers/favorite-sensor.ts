import { Resolver, Query, Ctx, Mutation, Arg } from "type-graphql";
import { Sensor } from "./sensor";
import { GraphQLResolverContext } from "../types";

@Resolver()
export class FavoriteSensorResolver {
    @Query(() => [Sensor])
    async favoriteSensors(@Ctx() context : GraphQLResolverContext) {
        const sensors = await context.storage.getFavoriteSensors(context.user);
        return sensors.filter(s => s.device?.house.id === context.user.houseId);
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
