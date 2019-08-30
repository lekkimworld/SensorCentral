import * as express from 'express';
import { BaseService, Sensor, RedisSensorMessage } from '../../../types';
import { StorageService } from '../../../services/storage-service';
import { stringify } from 'querystring';
import { read } from 'fs';
const {lookupService} = require('../../../configure-services');

const router = express.Router();
router.get('/devices/:deviceId/sensors', (req, res) => {
    res.type('json');
    const deviceId = req.params.deviceId;
    
    lookupService('storage').then((svc : BaseService) => {
        // get all sensors
        const storageService = svc as StorageService;
        return storageService.getSensors();

    }).then(sensors => {
        const sensorsForDevice = sensors
            .filter(sensor => sensor.device && sensor.device.id === deviceId)
            .reduce((prev, sensor) => {
                delete sensor.device;
                prev[sensor.id] = sensor;
                return prev;
            }, new Map<string, Sensor>());
        res.status(200).send(sensorsForDevice);
        
    }).catch((err : Error) => {
        console.log('Unable to lookup storage service');
        res.status(500).send({'error': true, 'message': err.message});
    })
})

router.get('/devices/?*?', (req, res) => {
    res.type('json');
    const params = req.params[0];
    const deviceId = params ? params.split('/')[0] : undefined;
    
    lookupService('storage').then((svc : BaseService) => {
        const storageService = svc as StorageService;

        if (!deviceId) {
            // get all devices
            return storageService.getDevices();
        } else {
            // get single device
            return storageService.getDeviceById(deviceId);    
        }

    }).then(devices => {
        res.status(200).send(devices);

    }).catch((err : Error) => {
        console.log('Unable to lookup storage service');
        res.status(500).send({'error': true, 'message': err.message});
    })
})

router.get('/sensors', (req, res) => {
    res.type('json');
    let queryKey = req.query.queryKey as string;
    let queryValue = req.query.queryValue as string;
    
    lookupService('storage').then((svc :  BaseService) => {
        const storageService = svc as StorageService;

        // get all sensors
        return Promise.all([Promise.resolve(storageService), storageService.getSensors()]);

    }).then((data : any) => {
        const storageService = data[0] as StorageService;
        const sensors = data[1] as Sensor[];
        
        // see if we should send all sensors
        if (!queryKey || !queryValue) {
            // we should
            return res.status(200).send(sensors);
        }
        
        // filter sensors
        const filteredSensors : Map<string,Sensor> = sensors.reduce((prev, sensor) => {
                if (queryKey === "id" && sensor.id === queryValue) prev.set(sensor.id,  sensor);
                if (queryKey === "label" && sensor.label === queryValue) prev.set(sensor.id,  sensor);
                if (queryKey === "name" && sensor.name === queryValue) prev.set(sensor.id,  sensor);
                return prev;
            }, new Map<string,Sensor>());
            
        if (!filteredSensors.size) {
            // unable to find sensors after filter
            return Promise.reject(Error(`Unable to find sensor(s) matching ${queryKey}=${queryValue}`));

        } else {
            // get recent readings for the selected sensor(s)
            return Promise.all([Promise.resolve(sensors), storageService.getRecentReadingBySensorIds(sensors.map(sensor => sensor.id))]);
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

        res.status(200).send(result);

    }).catch((err : Error) => {
        console.log('Unable to lookup storage service');
        res.status(404).send({'error': true, 'message': err.message});
    })
})

export default router;
