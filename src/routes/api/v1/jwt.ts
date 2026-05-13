import * as express from 'express';
import {lookupService} from "../../../configure-services";
import { IdentityService } from '../../../services/identity-service';
import { ensureAdminJWTScope } from "../../../middleware/ensureScope";

const router = express.Router();

router.get("/", ensureAdminJWTScope, async (req, res) => {
    const identity = await lookupService(IdentityService.NAME) as IdentityService;
    if (req.headers.accepts && req.headers.accepts.indexOf("text/plain") === 0) {
        res.type("text");
        res.status(200).send(identity.generateGodJWT());
    } else {
        res.type("json");
        res.status(200).send({
            "jwt": await identity.generateGodJWT()
        });
    }
})

export default router;