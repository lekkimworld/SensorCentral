import { middleware as httpContextMiddleware, set as setToHttpContext } from "express-http-context";
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
import { Logger } from "./logger";
import constants from "./constants";
import { v1 as uuid } from "uuid";

// logger
const logger = new Logger("configure-express");

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
                const redirectUrl = `https://${req.headers.host}${req.originalUrl}`;
                logger.info(`User is not using TLS - redirecting user to ${redirectUrl}`);
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

    // use http context to attach request ids to all requests
    app.use(httpContextMiddleware);
    app.use((req, res, next) => {
        // generate request id
        const reqId = uuid();
        setToHttpContext(constants.HTTP_CONTEXT.REQUEST_ID, reqId);

        // set request ID header
        res.set("X-Request-ID", reqId);

        // log request
        logger.debug(`path <${req.path}> method <${req.method}> secure <${req.secure}> headers <${Object.keys(req.headers).map(h => `${h}=${h === "authorization" ? "EXCLUDED" : req.header(h)}`).join(",")}>`);

        // next
        next();
    });

    // add routes to app
    await attachApplicationRoutes(app);

    // add middleware to convert HttpException
    app.use(formatHttpException);

    // log
    logger.info(`Done configuring Express...`);

    // return the app
    return app;
};
