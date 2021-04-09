import session from 'express-session';
import RedisStore from 'connect-redis';
import constants from "./constants";
import { RedisClient } from "redis";
import {v4 as uuid} from "uuid";

const secret = (function() {
    if (process.env.SESSION_SECRET) {
        console.log(`Using SESSION_SECRET provided by environment`);
        return process.env.SESSION_SECRET;
    } else {
        console.log(`No SESSION_SECRET found in envionment - will cause problems if more than 1 web process`);
        return uuid();
    }
})();
console.log(`Read session timeout in sesconds as <${constants.DEFAULTS.SESSION_TIMEOUT_SECONDS}>`);
const redisStoreInstance = RedisStore(session);
export default (redisClient : RedisClient) => {
    return session({
        "saveUninitialized": false,
        "resave": false,
        "secret": secret,
        "store": new redisStoreInstance({
            "client": redisClient,
            "prefix": "session:",
            "ttl": constants.DEFAULTS.SESSION_TIMEOUT_SECONDS
        })
    })
}
