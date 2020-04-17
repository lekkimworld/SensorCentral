import express from 'express';
import bodyparser from 'body-parser';
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
    app.use(bodyparser.json());
    configureHandlebars(app);

    // sessions
    const redisService = await lookupService("redis") as RedisService;
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