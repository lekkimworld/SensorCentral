import { Application } from "express";
import "reflect-metadata";
import { ApolloServer } from "apollo-server-express";
import { buildSchema, Resolver, Query } from "type-graphql";
import ensureAuthenticated from "./middleware/ensureAuthenticated";

const path = process.env.GRAPHQL_PATH || "/graphql";

@Resolver()
class HelloResolver {
    @Query(() => String, { name: "hellolekkim", description: "Says hello to lekkim", nullable: false })
    async hello() {
        return "Hello, lekkim, World!!!";
    }
}

export default async (app : Application) => {
    // attach a middleware to the graphql path to ensure user is authenticated 
    // either with a session or a JWT
    app.use(path, ensureAuthenticated);

    // define schema
    const schema = await buildSchema({
        resolvers: [HelloResolver]
    })

    // see if we should enable playground
    const enablePlayground = process.env.NODE_ENV === "development" || process.env.GRAPHQL_ENABLE_PLAYGROUND !== undefined;
    if (enablePlayground) {
        console.log("Enabling GraphQL Playground");
    }
    const apolloServer = new ApolloServer({
        schema,
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
