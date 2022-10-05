import express from "express";
import { json as bp_json, raw as bp_raw } from "body-parser";
import path from "path";
import attachApplicationRoutes from "./configure-express-routes";
import configureSessionWithRedis from "./configure-express-session";
//@ts-ignore
import { lookupService } from "./configure-services";
import { RedisService } from "./services/redis-service";
import configureHandlebars from "./configure-express-handlebars";
import formatHttpException from "./middleware/formatHttpException";
import { LogService } from "./services/log-service";
import constants from "./constants";

export default async () => {
    // create app
    const app = express();
    app.disable("x-powered-by");

    if (process.env.NODE_ENV !== "development") {
        app.enable("trust proxy");
        app.get("*", async (req, res, next) => {
            if (req.secure || constants.APP.NO_PROD_TLS) {
                next();
            } else {
                const logService = (await lookupService(LogService.NAME)) as LogService;
                const redirectUrl = `https://${req.headers.host}${req.originalUrl}`;
                logService.info(`User is not using TLS - redirecting user to ${redirectUrl}`);
                res.redirect(redirectUrl);
            }
        });
    }

    // configure app
    app.use(express.static(path.join(__dirname, "..", "public")));
    app.use(bp_json());
    app.use(bp_raw()); // for smart.me protobuf
    configureHandlebars(app);

    // sessions
    const redisService = (await lookupService(RedisService.NAME)) as RedisService;
    app.use(configureSessionWithRedis(redisService.getClient()));

    // add routes to app
    await attachApplicationRoutes(app);

    // add middleware to convert HttpException
    app.use(formatHttpException);

    // log
    console.log(`Done configuring Express...`);

    // return the app
    return app;
};
