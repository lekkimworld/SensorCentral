import express from 'express';
import {ensureAdminScope, ensureReadScopeWhenGetRequest } from "../../../middleware/ensureScope"; 
import { StorageService } from '../../../services/storage-service';
import { HttpException, BackendIdentity } from '../../../types';
const {lookupService} = require('../../../configure-services');

const router = express.Router();

// ensure READ scope for GET requests
router.use(ensureReadScopeWhenGetRequest);

/**
 * Return specific sensor.
 */
router.get("/:sensorid", async (req, res, next) => {
    if (!req.params.sensorid) return next(new HttpException(417, "Did not receive sensor id"));

    const user = res.locals.user;
    const storage = lookupService(StorageService.NAME) as StorageService;
    try {
        const sensor = storage.getSensor(user, req.params.sensorid)
        res.status(200).send(sensor);

    } catch(err) {
        return next(new HttpException(500, `Unable to return sensor with id (${err.message})`, err));
    }
})

// ensure ADMIN scope for other routes
router.use(ensureAdminScope);

/**
 * Create a new Sensor.
 */
router.post("/", async (req, res, next) => {
    // get body and validate
    const input = req.body as any;
    if (!input.hasOwnProperty("device") || !input.device.trim()) {
        return next(new HttpException(417, "Missing device ID in device-property"));
    }
    if (!input.hasOwnProperty("id") || !input.id.trim()) {
        return next(new HttpException(417, "Missing ID in \"id\" property"));
    }
    if (!input.hasOwnProperty("name") || !input.name.trim()) {
        return next(new HttpException(417, "Missing name in \"name\" property"));
    }
    if (!input.hasOwnProperty("label") || !input.label.trim()) {
        return next(new HttpException(417, "Missing label in \"label\" property"));
    }
    if (!input.hasOwnProperty("type") || !input.type.trim()) {
        return next(new HttpException(417, "Missing type in \"type\" property"));
    }

    // ensure access to house
    const user = res.locals.user as BackendIdentity;
    const storage = await lookupService(StorageService.NAME) as StorageService;
    try {
        const sensor = await storage.createSensor(user, {
            "deviceId": input.device,
            "id": input.id,
            "name": input.name,
            "label": input.label,
            "type": input.type,
            "icon": input.icon,
            "scaleFactor": input.scaleFactor
        })
        res.status(201).send(sensor);

    } catch (err) {
        next(new HttpException(417, "Unable to create requested sensor", err));
    }
})

/**
 * Update a Sensor.
 */
router.put("/", async (req, res, next) => {
    // get body and validate
    const input = req.body as any;
    if (!input.hasOwnProperty("id") || !input.id.trim()) {
        return next(new HttpException(417, "Missing ID in \"id\" property"));
    }
    if (!input.hasOwnProperty("name") || !input.name.trim()) {
        return next(new HttpException(417, "Missing name in \"name\" property"));
    }
    if (!input.hasOwnProperty("label") || !input.label.trim()) {
        return next(new HttpException(417, "Missing label in \"label\" property"));
    }
    if (!input.hasOwnProperty("type") || !input.type.trim()) {
        return next(new HttpException(417, "Missing type in \"type\" property"));
    }
    
    // ensure access to house
    const user = res.locals.user as BackendIdentity;
    const storage = await lookupService(StorageService.NAME) as StorageService;
    try {
        const sensor = await storage.updateSensor(user, {
            "id": input.id,
            "name": input.name,
            "label": input.label,
            "type": input.type,
            "icon": input.icon,
            "scaleFactor": input.scaleFactor
        })
        res.status(201).send(sensor);

    } catch (err) {
        next(new HttpException(417, "Unable to update requested sensor", err));
    }
})

/**
 * Deletes an existing Sensor.
 */
router.delete("/", async (req, res, next) => {
    // get body and validate
    const input = req.body as any;
    if (!input.hasOwnProperty("id") || !input.id) {
        return next(new HttpException(417, "Missing ID"));
    }
    
    const user = res.locals.user;
    const storage = await lookupService("storage") as StorageService;
    try {
        await storage.deleteSensor(user, {
            "id": input.id
        })
        res.status(202);

    } catch (err) {
        next(new HttpException(417, "Unable to update requested sensor", err));
    }
})

export default router;
