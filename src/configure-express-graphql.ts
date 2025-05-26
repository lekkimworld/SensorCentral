import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { InMemoryLRUCache } from "@apollo/utils.keyvaluecache";
import cors from "cors";
import { Application } from "express";
import { buildSchema } from "type-graphql";
import ensureAuthenticated from "./middleware/ensureAuthenticated";
import { DeviceResolver } from "./resolvers/device";
import { HouseResolver } from "./resolvers/house";
import { SensorResolver } from "./resolvers/sensor";
import { SettingsResolver } from "./resolvers/settings";
//@ts-ignore
import { lookupService } from "./configure-services";
import { CalloutAuthenticatorTemplateResolver } from "./resolvers/callout-authenticator-templates";
import constants from "./constants";
import { Logger } from "./logger";
import { AlertResolver } from "./resolvers/alert";
import { CalloutEndpointResolver } from "./resolvers/callout-endpoint";
import { CalloutSecretResolver } from "./resolvers/callout-secret";
import { DataQueryResolver } from "./resolvers/data";
import { EventResolver } from "./resolvers/event";
import { PowerPriceResolver } from "./resolvers/powerprice";
import { SmartmeResolver } from "./resolvers/smartme";
import { UsersResolver } from "./resolvers/user";
import { StorageService } from "./services/storage-service";
import { BackendIdentity, GraphQLResolverContext } from "./types";
import { CalloutResolver } from "./resolvers/callout";
import { CalloutAuthenticatorResolver } from "./resolvers/callout-authenticator";

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
            PowerPriceResolver,
            CalloutResolver,
            CalloutAuthenticatorResolver,
            CalloutEndpointResolver,
            CalloutSecretResolver,
            CalloutAuthenticatorTemplateResolver
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
