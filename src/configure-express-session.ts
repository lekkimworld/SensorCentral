import session, { SessionOptions } from "express-session";
import RedisStore from "connect-redis";
import constants from "./constants";
import { Redis } from "ioredis";
import { v4 as uuid } from "uuid";
import { Logger} from "./logger";

const logger = new Logger("configure-express-session");

const secret = (function () {
    if (process.env.SESSION_SECRET) {
        logger.info(`Using SESSION_SECRET provided by environment`);
        return process.env.SESSION_SECRET;
    } else {
        logger.info(`No SESSION_SECRET found in envionment - will cause problems if more than 1 web process`);
        return uuid();
    }
})();
logger.info(`Read session timeout in sesconds as <${constants.DEFAULTS.SESSION_TIMEOUT_SECONDS}>`);
const redisStoreInstance = RedisStore(session);

export default (redisClient: Redis) => {
    // create session options
    const sessionOptions: SessionOptions = {
        saveUninitialized: false,
        resave: false,
        secret: secret,
        store: new redisStoreInstance({
            client: redisClient,
            prefix: "session:",
            ttl: constants.DEFAULTS.SESSION_TIMEOUT_SECONDS,
        }),
    };

    // should we ensure secure cookies?
    if (process.env.NODE_ENV === "production" && !constants.APP.NO_PROD_TLS) {
        logger.info("NODE_ENV set to 'production' - enforcing cookie settings");
        sessionOptions.cookie = {
            secure: true,
        };
        sessionOptions.proxy = true;
    }

    // create sessions
    return session(sessionOptions);
};
