import session, { SessionOptions } from 'express-session';
import RedisStore from 'connect-redis';
import {constants} from "./constants";
import { RedisClient } from "redis";
import uuid from "uuid/v4";

const DEFAULT_SESSION_TTL = constants.DEFAULTS.SESSION_TIMEOUT_HOURS;
const ttl = (function() {
    let hours;
    if (process.env.SESSION_TTL) {
        try {
            hours = (process.env.SESSION_TTL as unknown as number) - 0;
            console.log(`Session TTL is set to ${hours} hours`);
        } catch (err) {}
    }
    if (!hours) {
        console.log(`ERROR reading SESSION_TTL from environment (${process.env.SESSION_TTL}) - session TTL is set to default (${DEFAULT_SESSION_TTL}) hours`);
        hours = DEFAULT_SESSION_TTL;
    }
    return hours * 60 * 60;
})();
const secret = (function() {
    if (process.env.SESSION_SECRET) {
        console.log(`Using SESSION_SECRET provided by environment`);
        return process.env.SESSION_SECRET;
    } else {
        console.log(`No SESSION_SECRET found in envionment - will cause problems if more than 1 web process`);
        return uuid();
    }
})();

const redisStoreInstance = RedisStore(session);
module.exports = (redisClient : RedisClient) => {
    return session({
        "saveUninitialized": false,
        "resave": false,
        "secret": secret,
        "store": new redisStoreInstance({
            "client": redisClient,
            "prefix": "session:",
            "ttl": ttl
        })
    })
}
