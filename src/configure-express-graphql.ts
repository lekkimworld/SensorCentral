import { Application } from "express";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { InMemoryLRUCache } from "@apollo/utils.keyvaluecache";
import cors from "cors";
import {buildSchema} from "type-graphql";
import ensureAuthenticated from "./middleware/ensureAuthenticated";
import {HouseResolver} from "./resolvers/house";
import {DeviceResolver} from "./resolvers/device";
import {SensorResolver} from "./resolvers/sensor";
import {SettingsResolver} from "./resolvers/settings";
//@ts-ignore
import { lookupService } from "./configure-services";
import { GraphQLResolverContext, BackendIdentity } from "./types";
import { DataQueryResolver } from "./resolvers/data";
import { SmartmeResolver } from "./resolvers/smartme";
import { StorageService } from "./services/storage-service";
import { UsersResolver } from "./resolvers/user";
import { Logger } from "./logger";
import { AlertResolver } from "./resolvers/alert";
import { EventResolver } from "./resolvers/event";
import { EndpointResolver } from "./resolvers/endpoint";
import { PowerPriceResolver } from "./resolvers/powerprice";
import constants from "./constants";

const logger = new Logger("configure-express-graphql");
const path = constants.DEFAULTS.GRAPHQL.PATH;

export default  async (app : Application) => {
    // storage service
    const storage = await lookupService(StorageService.NAME);
    
    // attach a middleware to the graphql path to ensure user is authenticated 
    // either with a session or a JWT
    app.use(path, ensureAuthenticated);

    // define schema
    const schema = await buildSchema({
        resolvers: [HouseResolver, 
            DeviceResolver, 
            SensorResolver, 
            SettingsResolver, 
            DataQueryResolver,
            SmartmeResolver,
            UsersResolver,
            AlertResolver,
            EventResolver,
            EndpointResolver,
            PowerPriceResolver
        ],
        dateScalarMode: "isoDate"
    })

    // create server
    const apolloServer =
        new ApolloServer<GraphQLResolverContext>({
            schema,
            introspection: true,
            cache: new InMemoryLRUCache(),
        });
    await apolloServer.start();

    // attach the middleware to the app
    app.use(constants.DEFAULTS.GRAPHQL.PATH, cors<cors.CorsRequest>(), expressMiddleware(apolloServer, {
        context: async ({ res }) : Promise<GraphQLResolverContext> => {
            const user = res.locals.user as BackendIdentity;
            return {
                storage,
                user,
            } as GraphQLResolverContext;
        }
    }));
    logger.info(`Applied middleware from Apollo at path ${path}`);
}
