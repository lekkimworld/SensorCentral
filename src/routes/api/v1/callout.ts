import {Router} from "express";
import { Logger } from '../../../logger';
import getService from "../../../services/service-locator";
import CalloutService from "../../../services/callout-service";
import { BackendIdentity, HttpException } from "../../../types";

const logger = new Logger("data");
const router = Router();

router.use((_req, res, next) => {
    res.type('text');
    next();
})

router.get("/:id", async (req, res) => {
    // get services
    const calloutSvc = getService<CalloutService>(CalloutService.NAME);

    // get user
    const user = res.locals.user as BackendIdentity;

    try {
        // invoke
        const response = await calloutSvc.calloutById<any>(user, req.params.id, {});
        res.send(response);

    } catch (err) {
        throw new HttpException(404, err.message);
    }
})

router.post("/:id", async (req, res) => {
    // get services
    const calloutSvc = getService<CalloutService>(CalloutService.NAME);

    // get user
    const user = res.locals.user as BackendIdentity;

    try {
        // invoke
        const response = await calloutSvc.calloutById<any>(user, req.params.id, req.body);
        res.send(response);

    } catch (err) {
        throw new HttpException(404, err.message);
    }
})

export default router;
