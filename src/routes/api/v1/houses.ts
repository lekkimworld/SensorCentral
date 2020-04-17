import * as express from 'express';
import { StorageService } from '../../../services/storage-service';
import { House, APIUserContext,  HttpException } from '../../../types';
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
router.get("/", (req, res) => {
    lookupService("storage").then((svc : StorageService) => {
        return svc.getHouses();
    }).then((houses : House[]) => {
        // get context
        const apictx = res.locals.api_context as APIUserContext;
        if (apictx.accessAllHouses()) {
            res.status(200).send(houses);
        } else {
            res.status(200).send(houses.filter(h => h.id === apictx.houseid));
        }
    })
})

/**
 * Retrieves the house with the specified ID.
 * 
 */
router.get("/:houseid", (req, res) => {
    lookupService("storage").then((svc : StorageService) => {
        return svc.getHouses();
    }).then((houses : House[]) => {
        const house2send = houses.filter(h => h.id === req.params.houseid);
        if (house2send.length === 0) {
            res.status(404).send({"error": true, "message": "House not found"});
        } else {
            res.status(200).send(house2send[0]);
        }
    })
})

/**
 * Create a new House.
 */
router.post("/", (req, res, next) => {
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
    
    lookupService("storage").then((svc : StorageService) => {
        return svc.createHouse(input.name.trim());
        
    }).then((house: House) => {
        res.status(201).send(house);

    }).catch((err : Error) => {
        next(new HttpException(417, "A house with that name already exists", err));
    })
})

/**
 * Updates an existing House.
 */
router.put("/", (req, res, next) => {
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
    
    lookupService("storage").then((svc : StorageService) => {
        return svc.updateHouse(input.id.trim(), input.name.trim());
        
    }).then((house: House) => {
        res.status(201).send(house);
        
    }).catch((err : Error) => {
        res.status(417).send({"error": true, "message": `Unable to update house (${err.message})`});
    })
})

/**
 * Deletes an existing House.
 */
router.delete("/", (req, res, next) => {
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
    
    lookupService("storage").then((svc : StorageService) => {
        return svc.deleteHouse(input.id.trim());
        
    }).then(() => {
        res.status(202).send();
        
    }).catch((err : Error) => {
        next(new HttpException(500, `Unable to delete house (${err.message})`));
    })
})

export default router;