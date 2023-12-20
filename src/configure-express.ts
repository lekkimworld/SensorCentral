import { middleware as httpContextMiddleware, set as setToHttpContext } from "express-http-context";
import express, { Response, Send } from "express";
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

declare global {
    namespace Express {
        interface Response {
            contentBody?: any;
        }
    }
}


// logger
const logger = new Logger("configure-express");
const loggerHttp = new Logger("http");

const resDotSendInterceptor = (res: Response, send: Send) => (content?: any) : any => {
    // store constent
    res.contentBody = content;

    // swap method back
    res.send = send;

    // send content
    return res.send(content);
};

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
        const requestPath = req.path;
        const baseCtx = {
            path: requestPath, 
            method: req.method, 
            secure: req.secure, 
            headers: {} as Record<string,string|number|string[]>
        }
        const requestCtx = Object.assign({}, baseCtx, {body: req.body});
        Object.keys(req.headers).forEach((h : string) => {
            requestCtx.headers[h] = (h === "authorization" ? "EXCLUDED" : h ? req.header(h) : "EMPTY")!;
        })
        loggerHttp.trace(`HTTP request ${JSON.stringify(requestCtx)}`);

        // intercept calls to response.send
        res.send = resDotSendInterceptor(res, res.send);
        res.on("finish", () => {
            const responseCtx = Object.assign({}, baseCtx, { body: res.contentBody });
            Object.keys(res.getHeaders()).forEach((h: string) => {
                responseCtx.headers[h] = (h === "authorization" ? "EXCLUDED" : h ? res.getHeader(h) : "EMPTY")!;
            });
            loggerHttp.trace(
                `HTTP response ${JSON.stringify(responseCtx)}`);
        });
        
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
