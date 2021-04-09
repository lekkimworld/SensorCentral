import express from 'express';
import {json as bp_json, raw as bp_raw} from 'body-parser';
import path from 'path';
import attachApplicationRoutes from './configure-express-routes';
import configureSessionWithRedis from "./configure-express-session";
//@ts-ignore
import { lookupService } from "./configure-services";
import { RedisService } from './services/redis-service';
import configureHandlebars from './configure-express-handlebars';
import formatHttpException from './middleware/formatHttpException';

export default async () => {
    // create app
    const app = express();
    app.disable('x-powered-by');

    // configure app
    app.use(express.static(path.join(__dirname, '..', 'public')));
    app.use(bp_json());
    app.use(bp_raw()); // for smart.me protobuf
    configureHandlebars(app);

    // sessions
    const redisService = await lookupService(RedisService.NAME) as RedisService;
    app.use(configureSessionWithRedis(redisService.getClient()));

    // add routes to app
    await attachApplicationRoutes(app);

    // add middleware to convert HttpException
    app.use(formatHttpException);

    // log
    console.log(`Done configuring Express...`);

    // return the app
    return app
}
