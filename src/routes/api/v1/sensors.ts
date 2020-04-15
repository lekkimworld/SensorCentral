import * as express from 'express';
import { StorageService } from '../../../services/storage-service';
import { Device, Sensor, APIUserContext, BaseService, RedisSensorMessage, ErrorObject, HttpException } from '../../../types';
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
router.post("/", (req, res, next) => {
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
    if (!["temp","hum"].includes(input.type.trim())) {
        return next(new HttpException(417, "Missing type may be \"temp\" or \"hum\""));
    }

    // ensure access to house
    if (!apictx.accessAllHouses() && apictx.houseid !== input.house.trim()) {
        return next(new HttpException(401, "You may not create sensors for the supplied house ID"));
    }
    
    lookupService("storage").then((svc : StorageService) => {
        return svc.createSensor(input.device.trim(), input.id.trim(), input.name.trim(), input.label.trim(), input.type.trim());
        
    }).then((sensor: Sensor) => {
        res.status(201).send(sensor);

    }).catch((err : Error) => {
        return next(new HttpException(417, `A device with that id / name may already exists (${err ? err.message : ""})`));
    })
})

/**
 * Update a Sensor.
 */
router.put("/", (req, res, next) => {
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
    if (!["temp","hum"].includes(input.type.trim())) {
        return next(new HttpException(417, "Missing type may be \"temp\" or \"hum\""));
    }

    // ensure access to house
    if (!apictx.accessAllHouses() && apictx.houseid !== input.house.trim()) {
        return next(new HttpException(401, "You may not update sensors for the supplied house ID"));
    }
    
    lookupService("storage").then((svc : StorageService) => {
        return svc.updateSensor(input.id.trim(), input.name.trim(), input.label.trim(), input.type.trim());
        
    }).then((device: Device) => {
        res.status(201).send(device);

    }).catch((err : Error) => {
        res.status(417).send({"error": true, "message": `A device with that id / name may already exists (${err ? err.message : ""})`});
    })
})

/**
 * Deletes an existing Sensor.
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
        return svc.deleteSensor(input.id.trim());
        
    }).then(() => {
        res.status(202).send();
        
    }).catch((err : Error) => {
        res.status(500).send({"error": true, "message": `Unable to delete sensor (${err.message})`});
    })
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
        return Promise.all([Promise.resolve(logService), Promise.resolve(storageService), storageService.getSensors()]);

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
router.get("/:sensorid", (req, res, next) => {
    if (!req.params.sensorid) return next(new HttpException(417, "Did not receive sensor id"));

    lookupService("storage").then((svc : StorageService) => {
        return svc.getSensorById(req.params.sensorid);

    }).then((sensor : Sensor) => {
        res.status(200).send(sensor);

    }).catch((err : Error) => {
        return next(new HttpException(500, `Unable to return sensor with id (${err.message})`, err));
    })
})

/**
 * Return all sensors
 */
//@ts-ignore
router.get("/", (req, res, next) => {
    lookupService("storage").then((svc : StorageService) => {
        return svc.getSensors();

    }).then((sensors : Sensor[]) => {
        res.status(200).send(sensors);

    }).catch((err : Error) => {
        return next(new HttpException(500, `Unable to return sensors (${err.message})`, err));
    })
})

export default router;