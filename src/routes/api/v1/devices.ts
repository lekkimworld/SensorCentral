import * as express from 'express';
import { StorageService } from '../../../services/storage-service';
import { Device, Sensor, APIUserContext, WatchdogNotification } from '../../../types';
import {constants} from "../../../constants";
const {lookupService} = require('../../../configure-services');

const router = express.Router();

router.use((req, res, next) => {
    // ensure correct scope
    const apictx = res.locals.api_context as APIUserContext;
    if (req.method === "get" && !apictx.hasScope(constants.DEFAULTS.API.JWT.SCOPE_READ)) {
        return res.status(401).send({"error": true, "message": `Unauthorized - missing ${constants.DEFAULTS.API.JWT.SCOPE_READ} scope`});
    }
    next();
})

/**
 * Create a new Device.
 */
router.post("/", (req, res) => {
    // ensure correct scope
    const apictx = res.locals.api_context as APIUserContext;
    if (!apictx.hasScope(constants.DEFAULTS.API.JWT.SCOPE_ADMIN)) {
        return res.status(401).send({"error": true, "message": `Unauthorized - missing ${constants.DEFAULTS.API.JWT.SCOPE_ADMIN} scope`});
    }

    // get body and validate
    const input = req.body as any;
    if (!input.hasOwnProperty("house") || !input.house) {
        return res.status(417).send({"error": true, "message": "Missing house ID in house-property"});
    }
    if (!input.hasOwnProperty("id") || !input.id) {
        return res.status(417).send({"error": true, "message": "Missing ID in \"id\" property"});
    }
    if (!input.hasOwnProperty("name") || !input.name) {
        return res.status(417).send({"error": true, "message": "Missing name in \"name\" property"});
    }

    // ensure access to house
    if (!apictx.accessAllHouses() && apictx.houseid !== input.house.trim()) {
        return res.status(401).send({"error": true, "message": "You may not create devices for the supplied house ID"});
    }
    
    lookupService("storage").then((svc : StorageService) => {
        return svc.createDevice(input.house.trim(), input.id.trim(), input.name.trim());
        
    }).then((device: Device) => {
        res.status(201).send(device);

    }).catch((err : Error) => {
        res.status(417).send({"error": true, "message": `A device with that id / name may already exists (${err ? err.message : ""})`});
    })
})

/**
 * Updates an existing Device.
 */
router.put("/", (req, res) => {
    // ensure correct scope
    const apictx = res.locals.api_context as APIUserContext;
    if (!apictx.hasScope(constants.DEFAULTS.API.JWT.SCOPE_ADMIN)) {
        return res.status(401).send({"error": true, "message": `Unauthorized - missing ${constants.DEFAULTS.API.JWT.SCOPE_ADMIN} scope`});
    }

    // get body and validate
    const input = req.body as any;
    if (!input.hasOwnProperty("id") || !input.id) {
        return res.status(417).send({"error": true, "message": "Missing ID"});
    }
    if (!input.hasOwnProperty("name") || !input.name) {
        return res.status(417).send({"error": true, "message": "Missing name"});
    }
    
    lookupService("storage").then((svc : StorageService) => {
        return svc.updateDevice(input.id.trim(), input.name.trim());
        
    }).then((device : Device) => {
        res.status(201).send(device);
        
    }).catch((err : Error) => {
        res.status(417).send({"error": true, "message": `Unable to update device (${err.message})`});
    })
})

/**
 * Deletes an existing Device.
 */
router.delete("/", (req, res) => {
    // ensure correct scope
    const apictx = res.locals.api_context as APIUserContext;
    if (!apictx.hasScope(constants.DEFAULTS.API.JWT.SCOPE_ADMIN)) {
        return res.status(401).send({"error": true, "message": `Unauthorized - missing ${constants.DEFAULTS.API.JWT.SCOPE_ADMIN} scope`});
    }

    // get body and validate
    const input = req.body as any;
    if (!input.hasOwnProperty("id") || !input.id) {
        return res.status(417).send({"error": true, "message": "Missing ID"});
    }
    
    lookupService("storage").then((svc : StorageService) => {
        return svc.deleteDevice(input.id.trim());
        
    }).then(() => {
        res.status(202).send();
        
    }).catch((err : Error) => {
        res.status(500).send({"error": true, "message": `Unable to delete device (${err.message})`});
    })
})

/**
 * Get all devices
 */
router.get('/', (req, res) => {
    lookupService('storage').then((svc : StorageService) => {
        return svc.getDevices();
        
    }).then((devices : Device[]) => {
        res.status(200).send(devices);

    }).catch((err : Error) => {
        console.log('Unable to lookup storage service');
        res.status(500).send({'error': true, 'message': err.message});
    })
})

/**
 * Get a device.
 */
router.get('/:deviceId', (req, res) => {
    const deviceId = req.params.deviceId;
    if (!deviceId) return res.status(417).send({"error":true, "message": "Missing device id"});
    
    lookupService("storage").then((svc : StorageService) => {
        return svc.getDeviceById(deviceId);
        
    }).then((device : Device) => {
        res.status(200).send(device);

    }).catch((err : Error) => {
        console.log(err.message);
        res.status(404).send({'error': true, 'message': `Device with id <${deviceId}> not found`});
    })
})

/**
 * Get the notification state of a device.
 */
router.get('/:deviceId/notify', (req, res) => {
    const deviceId = req.params.deviceId;
    if (!deviceId) return res.status(417).send({"error":true, "message": "Missing device id"});
    
    lookupService("storage").then((svc : StorageService) => {
        return svc.getDeviceById(deviceId);
        
    }).then((device : Device) => {
        res.status(200).send({
            "notify": device.notify === 0 ? "off" : device.notify === 1 ? "on" : "mute",
            "mutedUntil": device.mutedUntil ? device.mutedUntil.toISOString() : undefined
        })

    }).catch((err : Error) => {
        console.log(err.message);
        res.status(500).send({'error': true, 'message': err.message});
    })
})

/**
 * Update the notification state of a device.
 */
router.put('/:deviceId/notify', (req, res) => {
    // ensure correct scope
    const apictx = res.locals.api_context as APIUserContext;
    if (!apictx.hasScope(constants.DEFAULTS.API.JWT.SCOPE_ADMIN)) {
        return res.status(401).send({"error": true, "message": `Unauthorized - missing ${constants.DEFAULTS.API.JWT.SCOPE_ADMIN} scope`});
    }

    const deviceId = req.params.deviceId;
    const str_state = req.body.notify;
    if (!deviceId) return res.status(417).send({"error":true, "message": "Missing device id"});
    if (!["mute", "on", "off"].includes(str_state)) return res.status(417).send({"error":true, "message": "Invalid state sent - must be on, off or mute"});
    const state = str_state === "on" ? WatchdogNotification.yes : str_state === "off" ? WatchdogNotification.no : WatchdogNotification.muted;
    
    let didResponse = false;
    lookupService("storage").then((svc : StorageService) => {
        return Promise.all([Promise.resolve(svc), svc.getDeviceById(deviceId)]);
    }).catch((err : Error) => {
        return Promise.reject(Error('Unable to lookup storage service'));

    }).then((args : any[]) => {
        const svc = args[0] as StorageService;
        const device = args[1] as Device;

        // coming here means we have the device
        return svc.updateDeviceNotificationState(device, state);

    }).then((device : Device) => {
        res.status(200).send(device);

    }).catch((err : Error) => {
        console.log(err.message);
        res.status(500).send({'error': true, 'message': err.message});
    })
})

/**
 * Return sensors for a specific device.
 */
router.get('/:deviceId/sensors', (req, res) => {
    const deviceId = req.params.deviceId;
    
    lookupService('storage').then((svc : StorageService) => {
        // get all sensors
        return svc.getSensors(deviceId);

    }).then((sensors : Sensor[]) => {
        res.status(200).send(sensors);
        
    }).catch((err : Error) => {
        console.log('Unable to lookup storage service');
        res.status(500).send({'error': true, 'message': err.message});
    })
})

export default router;