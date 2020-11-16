import express from 'express';
import {ensureAdminScope, ensureReadScopeWhenGetRequest} from "../../../middleware/ensureScope"; 
import { StorageService } from '../../../services/storage-service';
import { HttpException } from '../../../types';
const {lookupService} = require('../../../configure-services');

const router = express.Router();

// ensure READ scope for GET requests
router.use(ensureReadScopeWhenGetRequest);

/**
 * Lists all houses.
 */
//@ts-ignore
router.get("/", async (req, res, next) => {
    const user = res.locals.user;
    const storage = await lookupService(StorageService.NAME) as StorageService;
    const houses = await storage.getHouses(user);
    res.status(200).send(houses);
})

/**
 * Retrieves the house with the specified ID.
 * 
 */
router.get("/:houseid", async (req, res, next) => {
    const houseId = req.params.houseid;
    const user = res.locals.user;
    if (!houseId) return next(new HttpException(417, "House ID not supplied"));

    const storage = await lookupService(StorageService.NAME) as StorageService;
    try {
        const house = await storage.getHouse(user, houseId);
        return res.status(200).send(house);

    } catch (err) {
        next(new HttpException(404, `House with ID <${houseId}> not found`, err));
    }
})

// ensure ADMIN scope for other routes
router.use(ensureAdminScope);

/**
 * Create a new House.
 */
router.post("/", async (req, res, next) => {
    // get body and validate
    const input = req.body as any;
    if (!input.hasOwnProperty("name") || !input.name) {
        return next(new HttpException(417, "Missing name in \"name\" property"));
    }
    
    try {
        const storage = await lookupService(StorageService.NAME) as StorageService;
        const user = res.locals.user;
        const house = await storage.createHouse(user, {
            "name": input.name
        })
        res.status(201).send(house);

    } catch (err) {
        next(new HttpException(500, "Unable to create house", err));
    }
})

/**
 * Updates an existing House.
 */
router.put("/", async (req, res, next) => {
    // get body and validate
    const input = req.body as any;
    if (!input.hasOwnProperty("id") || !input.id) {
        return next(new HttpException(417, "Missing ID in \"id\" property"));
    }
    if (!input.hasOwnProperty("name") || !input.name) {
        return next(new HttpException(417, "Missing name in \"name\" property"));
    }
    
    try {
        const user = res.locals.user;
        const storage = await lookupService(StorageService.NAME) as StorageService;
        const house = await storage.updateHouse(user, {
            "id": input.id,
            "name": input.name
        })
        res.status(201).send(house);
        
    } catch(err) {
        next(new HttpException(500, `Unable to update house (${err.message})`, err));
    }
})

/**
 * Deletes an existing House.
 */
router.delete("/", async (req, res, next) => {
    // get body and validate
    const input = req.body as any;
    if (!input.hasOwnProperty("id") || !input.id) {
        return next(new HttpException(417, "Missing ID"));
    }
    
    try {
        const user = res.locals.user;
        const storage = await lookupService(StorageService.NAME) as StorageService;
        await storage.deleteHouse(user, {
            "id": input.id
        })
        res.status(202).send();
        
    } catch(err) {
        next(new HttpException(500, `Unable to delete house (${err.message})`, err));
    }
})

export default router;
