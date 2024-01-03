import { BaseService, HttpException } from "../types";
import { middleware as httpContextMiddleware, set as setToHttpContext } from "express-http-context";
import express, { Express, Response, Send } from "express";
import { json as bp_json, raw as bp_raw } from "body-parser";
import path from "path";
import attachApplicationRoutes from "../configure-express-routes";
import configureSessionWithRedis from "../configure-express-session";
//@ts-ignore
import { lookupService } from "../configure-services";
import { RedisService } from "../services/redis-service";
import configureHandlebars from "../configure-express-handlebars";
import formatHttpException from "../middleware/formatHttpException";
import { Logger } from "../logger";
import constants from "../constants";
import { v1 as uuid } from "uuid";

declare global {
    namespace Express {
        interface Response {
            contentBody?: any;
        }
    }
}

// logger
const logger = new Logger("express-service");
const loggerHttpRequest = new Logger("http-request", true);
const loggerHttpResponse = new Logger("http-response", true);

const resDotSendInterceptor =
    (res: Response, send: Send) =>
    (content?: any): any => {
        // store constent
        res.contentBody = content;

        // swap method back
        res.send = send;

        // send content
        return res.send(content);
    };

export class ExpressService extends BaseService {
    public static NAME = "express";
    private app: Express|undefined;

    constructor() {
        super(ExpressService.NAME);
    }

    getExpress() {
        return this.app;
    }

    async configureExpress() {
        if (this.app) throw new Error("Express application already created");

        // create app
        this.app = express();
        this.app.disable("x-powered-by");

        if (process.env.NODE_ENV !== "development") {
            this.app.enable("trust proxy");
            this.app.get("*", async (req, res, next) => {
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
        this.app.use(express.static(path.join(__dirname, "..", "..", "public")));
        this.app.use(bp_json());
        this.app.use(bp_raw()); // for smart.me protobuf
        configureHandlebars(this.app);

        // sessions
        const redisService = (await lookupService(RedisService.NAME)) as RedisService;
        this.app.use(configureSessionWithRedis(redisService.getClient()));

        // use http context to attach request ids to all requests
        this.app.use(httpContextMiddleware);
        this.app.use((req, res, next) => {
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
                headers: {} as Record<string, string | number | string[]>,
            };
            const requestCtx = Object.assign({}, baseCtx, { body: req.body, is_request: true });
            Object.keys(req.headers).forEach((h: string) => {
                requestCtx.headers[h] = (h === "authorization" ? "EXCLUDED" : h ? req.header(h) : "EMPTY")!;
            });
            loggerHttpRequest.trace(requestCtx);

            // intercept calls to response.send
            res.send = resDotSendInterceptor(res, res.send);
            res.on("finish", () => {
                const responseCtx = Object.assign({}, baseCtx, {
                    status: res.statusCode,
                    body: res.contentBody,
                    is_response: true,
                });
                Object.keys(res.getHeaders()).forEach((h: string) => {
                    responseCtx.headers[h] = (h ? res.getHeader(h) : "EMPTY")!;
                });
                loggerHttpResponse.trace(responseCtx);
            });

            // next
            next();
        });

        // ensure authentication for /admin routes
        this.app.use("/admin", (req, res, next) => {
            if (req.headers.authorization) {
                const auth = Buffer.from(req.headers.authorization.split(" ")[1], "base64").toString().split(":");
                const username = auth[0];
                const password = auth[1];
                if (username === constants.ADMIN.USERNAME && password === constants.ADMIN.PASSWORD) return next();
            }

            // error
            res.setHeader("WWW-Authenticate", "Basic");
            return next(new HttpException(401, "You must login to see admin pages"));
        });

        // add routes to app
        await attachApplicationRoutes(this.app);

        // add middleware to convert HttpException
        this.app.use(formatHttpException);

        // log
        logger.info(`Done configuring Express...`);

        // return the app
        return this.app;
    }
    
}