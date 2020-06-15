import * as express from 'express';
import { StorageService } from '../../../services/storage-service';
import { HttpException, BackendLoginUser } from '../../../types';
import { ensureReadScopeWhenGetRequest, ensureAdminScope, accessAllHouses } from '../../../middleware/ensureScope';
const {lookupService} = require('../../../configure-services');

const router = express.Router();

// ensure READ scope for GET requests
router.use(ensureReadScopeWhenGetRequest);

router.get("/:houseid", async (req, res, next) => {
    const houseid = req.params.houseid;
    if (!houseid) return next(new HttpException(417, "No house ID supplied"));

    const storage = await lookupService("storage") as StorageService;
    try {
        const devices = await storage.getDevices(houseid);
        return res.status(200).send(devices);

    } catch (err) {
        return next(new HttpException(500, `Unable to find devices for house with ID <${houseid}>`, err));
    }
})

// ensure ADMIN scope for other routes
router.use(ensureAdminScope);

/**
 * Create a new Device.
 */
router.post("/", async (req, res, next) => {
    // get body and validate
    const input = req.body as any;
    if (!input.hasOwnProperty("house") || !input.house) {
        return next(new HttpException(417, "Missing house ID in house-property"));
    }
    if (!input.hasOwnProperty("id") || !input.id) {
        return next(new HttpException(417, "Missing ID in \"id\" property"));
    }
    if (!input.hasOwnProperty("name") || !input.name) {
        return next(new HttpException(417, "Missing name in \"name\" property"));
    }

    // ensure access to house
    const user = res.locals.user as BackendLoginUser;
    if (!accessAllHouses(user) && user.houseId !== input.house.trim()) {
        return next(new HttpException(401, "You may not create sensors for the supplied house ID"));
    }
    
    const storage = await lookupService("storage") as StorageService;
    try {
        const device = await storage.createDevice({
            "houseId": input.house,
            "id": input.id,
            "name": input.name,
            "active": input.active
        })
        res.status(201).send(device);

    } catch (err) {
        throw new HttpException(417, "Unable to create requested device", err);
    }
})

/**
 * Updates an existing Device.
 */
router.put("/", async (req, res, next) => {
    // get body and validate
    const input = req.body as any;
    if (!input.hasOwnProperty("id") || !input.id) {
        return next(new HttpException(417, "Missing ID"));
    }
    if (!input.hasOwnProperty("name") || !input.name) {
        return next(new HttpException(417, "Missing name"));
    }
    
    const storage = await lookupService("storage") as StorageService;
    try {
        const device = await storage.updateDevice({
            "id": input.id,
            "name": input.name,
            "active": input.active
        })
        res.status(201).send(device);

    } catch (err) {
        throw new HttpException(417, "Unable to update requested device", err);
    }
})

/**
 * Deletes an existing Device.
 */
router.delete("/", async (req, res, next) => {
    // get body and validate
    const input = req.body as any;
    if (!input.hasOwnProperty("id") || !input.id) {
        return next(new HttpException(417, "Missing ID"));
    }
    
    const storage = await lookupService("storage") as StorageService;
    try {
        await storage.deleteDevice({
            "id": input.id
        })
        res.status(202);

    } catch (err) {
        throw new HttpException(417, "Unable to delete requested device", err);
    }
})

export default router;