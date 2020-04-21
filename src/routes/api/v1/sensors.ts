import * as express from 'express';
import { StorageService } from '../../../services/storage-service';
import { Sensor, APIUserContext, BaseService, RedisSensorMessage, ErrorObject, HttpException } from '../../../types';
import constants from "../../../constants";
import { LogService } from '../../../services/log-service';
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
 * Create a new Sensor.
 */
router.post("/", async (req, res, next) => {
    // ensure correct scope
    const apictx = res.locals.api_context as APIUserContext;
    if (!apictx.hasScope(constants.DEFAULTS.API.JWT.SCOPE_ADMIN)) {
        return next(new HttpException(401, `Unauthorized - missing ${constants.DEFAULTS.API.JWT.SCOPE_ADMIN} scope`));
    }

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
    if (!apictx.accessAllHouses() && apictx.houseid !== input.house.trim()) {
        return next(new HttpException(401, "You may not create sensors for the supplied house ID"));
    }

    const storage = await lookupService("storage") as StorageService;
    try {
        const sensor = await storage.createSensor({
            "deviceId": input.device,
            "id": input.id,
            "name": input.name,
            "label": input.label,
            "type": input.type
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
    // ensure correct scope
    const apictx = res.locals.api_context as APIUserContext;
    if (!apictx.hasScope(constants.DEFAULTS.API.JWT.SCOPE_ADMIN)) {
        return next(new HttpException(401, `Unauthorized - missing ${constants.DEFAULTS.API.JWT.SCOPE_ADMIN} scope`));
    }

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
    if (!apictx.accessAllHouses() && apictx.houseid !== input.house.trim()) {
        return next(new HttpException(401, "You may not update sensors for the supplied house ID"));
    }
    
    const storage = await lookupService("storage") as StorageService;
    try {
        const sensor = await storage.updateSensor({
            "id": input.id,
            "name": input.name,
            "label": input.label,
            "type": input.type
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
    
    const storage = await lookupService("storage") as StorageService;
    try {
        await storage.deleteSensor({
            "id": input.id
        })
        res.status(202);

    } catch (err) {
        next(new HttpException(417, "Unable to update requested sensor", err));
    }
})

/**
 * Query for a specific sensor.
 */
router.get('/query', (req, res, next) => {
    let queryKey = req.query.queryKey as string;
    let queryValue = req.query.queryValue as string;
    if (!queryKey || !queryValue) return next(new HttpException(417, "Must send queryKey and queryValue"));
    
    lookupService(["log", "storage"]).then((svcs :  BaseService[]) => {
        const logService = svcs[0] as LogService;
        const storageService = svcs[1] as StorageService;
        logService.debug(`API query for sensors with queryKey <${queryKey}> and queryValue <${queryValue}>`);

        // get all sensors
        return Promise.all([Promise.resolve(logService), Promise.resolve(storageService), storageService.getSensors("foo")]);

    }).then((data : any) => {
        const logService = data[0] as LogService;
        const storageService = data[1] as StorageService;
        const sensors = data[2] as Sensor[];
        
        // see if we should send all sensors
        if (!queryKey || !queryValue) {
            // we should
            return res.status(200).send(sensors);
        }
        
        // filter sensors
        const filteredSensorIds : string[] = sensors.reduce((prev, sensor) => {
                if (queryKey === "id" && sensor.id === queryValue) prev.push(sensor.id);
                if (queryKey === "label" && sensor.label === queryValue) prev.push(sensor.id);
                if (queryKey === "name" && sensor.name === queryValue) prev.push(sensor.id);
                return prev;
            }, new Array<string>());
        logService.debug(`Filtered <${sensors.length}> sensors down to <${filteredSensorIds.length}> sensor id based on queryKey and queryValue`);
            
        if (!filteredSensorIds.length) {
            // unable to find sensors after filter
            return Promise.reject(Error(`Unable to find sensor(s) matching ${queryKey}=${queryValue}`));

        } else {
            // get recent readings for the selected sensor(s)
            return Promise.all([Promise.resolve(sensors), storageService.getRecentReadingBySensorIds(filteredSensorIds)]);
        }
    }).then((data : any) => {
        const sensors = data[0] as Sensor[];
        const readings = data[1] as Map<string,RedisSensorMessage>;
        const result = sensors.filter(sensor => Array.from(readings.keys()).includes(sensor.id)).map(sensor => {
            return {
                "id": sensor.id,
                "name": sensor.name,
                "label": sensor.label, 
                "type": sensor.type,
                "value": readings.get(sensor.id) ? readings.get(sensor.id)!.value : undefined,
                "dt":  readings.get(sensor.id) ? readings.get(sensor.id)!.dt : undefined
            }
        })

        res.status(200).send(result.length === 1 ? result[0] : result);

    }).catch((err : Error) => {
        console.log('Unable to lookup storage service');
        res.status(404).send(new ErrorObject(err.message));
    })
})

/**
 * Return specific sensor.
 */
router.get("/:sensorid", async (req, res, next) => {
    if (!req.params.sensorid) return next(new HttpException(417, "Did not receive sensor id"));

    const storage = lookupService("storage") as StorageService;
    try {
        const sensor = storage.getSensor(req.params.sensorid)
        res.status(200).send(sensor);

    } catch(err) {
        return next(new HttpException(500, `Unable to return sensor with id (${err.message})`, err));
    }
})

export default router;