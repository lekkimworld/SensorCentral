import * as express from 'express';
import { StorageService } from '../../../services/storage-service';
import { APIUserContext,  HttpException } from '../../../types';
import constants from "../../../constants";
const {lookupService} = require('../../../configure-services');

const router = express.Router();

router.use((req, res, next) => {
    // ensure correct scope
    const apictx = res.locals.api_context as APIUserContext;
    if (req.method === "get" && !apictx.hasScope(constants.DEFAULTS.API.JWT.SCOPE_READ)) {
        return next(new HttpException(401, `Unauthorized - missing ${constants.DEFAULTS.API.JWT.SCOPE_READ} scope`));
    }
    next();
})

/**
 * Lists all houses.
 */
//@ts-ignore
router.get("/", async (req, res, next) => {
    const storage = await lookupService("storage") as StorageService;
    const houses = await storage.getHouses();
    res.status(200).send(houses);
})

/**
 * Retrieves the house with the specified ID.
 * 
 */
router.get("/:houseid", async (req, res, next) => {
    const houseId = req.params.houseid;
    if (!houseId) return next(new HttpException(417, "House ID not supplied"));

    const storage = await lookupService("storage") as StorageService;
    try {
        const house = await storage.getHouse(houseId);
        return res.status(200).send(house);

    } catch (err) {
        next(new HttpException(404, `House with ID <${houseId}> not found`, err));
    }
})

/**
 * Create a new House.
 */
router.post("/", async (req, res, next) => {
    // ensure correct scope
    const apictx = res.locals.api_context as APIUserContext;
    if (!apictx.hasScope(constants.DEFAULTS.API.JWT.SCOPE_ADMIN)) {
        return next(new HttpException(401, `Unauthorized - missing ${constants.DEFAULTS.API.JWT.SCOPE_ADMIN} scope`));
    }

    // get body and validate
    const input = req.body as any;
    if (!input.hasOwnProperty("name") || !input.name) {
        return next(new HttpException(417, "Missing name in \"name\" property"));
    }
    
    try {
        const storage = await lookupService("storage") as StorageService;
        const house = await storage.createHouse({
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
    // ensure correct scope
    const apictx = res.locals.api_context as APIUserContext;
    if (!apictx.hasScope(constants.DEFAULTS.API.JWT.SCOPE_ADMIN)) {
        return next(new HttpException(401, `Unauthorized - missing ${constants.DEFAULTS.API.JWT.SCOPE_ADMIN} scope`));
    }

    // get body and validate
    const input = req.body as any;
    if (!input.hasOwnProperty("id") || !input.id) {
        return next(new HttpException(417, "Missing ID in \"id\" property"));
    }
    if (!input.hasOwnProperty("name") || !input.name) {
        return next(new HttpException(417, "Missing name in \"name\" property"));
    }
    
    try {
        const storage = await lookupService("storage") as StorageService;
        const house = await storage.updateHouse({
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
    // ensure correct scope
    const apictx = res.locals.api_context as APIUserContext;
    if (!apictx.hasScope(constants.DEFAULTS.API.JWT.SCOPE_ADMIN)) {
        return next(new HttpException(401, `Unauthorized - missing ${constants.DEFAULTS.API.JWT.SCOPE_ADMIN} scope`));
    }

    // get body and validate
    const input = req.body as any;
    if (!input.hasOwnProperty("id") || !input.id) {
        return next(new HttpException(417, "Missing ID"));
    }
    
    try {
        const storage = await lookupService("storage") as StorageService;
        await storage.deleteHouse({
            "id": input.id
        })
        res.status(202).send();
        
    } catch(err) {
        next(new HttpException(500, `Unable to delete house (${err.message})`, err));
    }
})

export default router;
