import * as express from "express";
import constants from "../../../constants";
import {objectHasOwnProperty} from "../../../utils";
const {lookupService} = require('../../../configure-services');
import { ensureAdminJWTScope } from "../../../middleware/ensureScope";
import { WatchdogService } from "../../../services/watchdog-service";

const router = express.Router();

// ensure admin scope
router.use(ensureAdminJWTScope);

router.get("/", async (_req, res) => {
    const watchdog = await lookupService(WatchdogService.NAME) as WatchdogService;
    res.send({
        "settings": {
            timeout: constants.DEFAULTS.WATCHDOG.DEFAULT_TIMEOUT
        },
        "env_vars": {
            WATCHDOG_DISABLED: objectHasOwnProperty(process.env, "WATCHDOG_DISABLED") ? process.env.WATCHDOG_DISABLED : "not_set",
            WATCHDOG_INTERVAL: objectHasOwnProperty(process.env, "WATCHDOG_INTERVAL") ? process.env.WATCHDOG_INTERVAL : "not_set",
            NOTIFICATIONS_DISABLED: objectHasOwnProperty(process.env, "NOTIFICATIONS_DISABLED") ? process.env.NOTIFICATIONS_DISABLED : "not_set"
        },
        "watchdogs": watchdog.getAll()
    });
});

export default router;
