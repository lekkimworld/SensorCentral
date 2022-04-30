import { Application } from "express";
import "reflect-metadata";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import ensureAuthenticated from "./middleware/ensureAuthenticated";
import constants from "./constants";
import {HouseResolver} from "./resolvers/house";
import {DeviceResolver} from "./resolvers/device";
import {SensorResolver} from "./resolvers/sensor";
import {SettingsResolver} from "./resolvers/settings";
import {DeviceWatchdogResolver} from "./resolvers/device-watchdog";
//@ts-ignore
import { lookupService } from "./configure-services";
import { GraphQLResolverContext, BackendIdentity } from "./types";
import { FavoriteSensorResolver } from "./resolvers/favorite-sensor";
import { CounterQueryResolver } from "./resolvers/data";
import { SmartmeResolver } from "./resolvers/smartme";
import { StorageService } from "./services/storage-service";
import { UsersResolver } from "./resolvers/user";

const path = process.env.GRAPHQL_PATH || "/graphql";

export default async (app : Application) => {
    // storage service
    const storage = await lookupService(StorageService.NAME);
    
    // attach a middleware to the graphql path to ensure user is authenticated 
    // either with a session or a JWT
    app.use(path, ensureAuthenticated);

    // define schema
    const schema = await buildSchema({
        resolvers: [
            HouseResolver, 
            DeviceResolver, 
            SensorResolver, 
            SettingsResolver, 
            DeviceWatchdogResolver,
            FavoriteSensorResolver,
            CounterQueryResolver,
            SmartmeResolver,
            UsersResolver],
            "dateScalarMode": "isoDate"
    })

    // see if we should enable playground
    const enablePlayground = constants.DEFAULTS.GRAPHQL_ENABLE_PLAYGROUND;
    if (enablePlayground) {
        console.log("Enabling GraphQL Playground");
    }
    const apolloServer = new ApolloServer({
        schema,
        "context": ({ res }) : GraphQLResolverContext => {
            const user = res.locals.user as BackendIdentity;
            return {
                storage,
                user
            } as GraphQLResolverContext
        },
        "introspection": enablePlayground,
        "playground": enablePlayground
    });

    // attach the middleware to the app
    apolloServer.applyMiddleware({
        "path": path,
        "app": app
    });
    console.log(`Applied middleware from Apollo at path ${path}`);
}
