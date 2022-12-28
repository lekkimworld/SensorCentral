import * as express from "express";
import { ensureAdminJWTScope } from "../../../middleware/ensureScope";

const router = express.Router();

// ensure admin scope
router.use(ensureAdminJWTScope);

router.get("/devices", async (_req, res) => {
    res.status(500).send("Device watchdog removed for now");
    /*
    const watchdog = await lookupService(WatchdogService.NAME) as WatchdogService;
    res.send({
        "settings": {
            timeout: constants.DEFAULTS.WATCHDOG.DEVICES.TIMEOUT
        },
        "env_vars": {
            WATCHDOG_DISABLED_DEVICES: objectHasOwnProperty(process.env, "WATCHDOG_DISABLED_DEVICES") ? process.env.WATCHDOG_DISABLED_DEVICES : "not_set",
            WATCHDOG_INTERVAL_DEVICES: objectHasOwnProperty(process.env, "WATCHDOG_INTERVAL_DEVICES") ? process.env.WATCHDOG_INTERVAL_DEVICES : "not_set",
            NOTIFICATIONS_DISABLED: objectHasOwnProperty(process.env, "NOTIFICATIONS_DISABLED") ? process.env.NOTIFICATIONS_DISABLED : "not_set"
        },
        "watchdogs": watchdog.getAllDevices()
    });
    */
});
router.get("/sensors", async (_req, res) => {
    res.status(500).send("Sensor watchdog removed for now");
    /*
    const watchdog = (await lookupService(WatchdogService.NAME)) as WatchdogService;
    res.send({
        settings: {
            timeout: constants.DEFAULTS.WATCHDOG.SENSORS.TIMEOUT,
        },
        env_vars: {
            WATCHDOG_INTERVAL_SENSORS: objectHasOwnProperty(process.env, "WATCHDOG_INTERVAL_SENSORS")
                ? process.env.WATCHDOG_INTERVAL_SENSORS
                : "not_set"
        },
        watchdogs: watchdog.getAllSensors(),
    });
    */
});

export default router;
