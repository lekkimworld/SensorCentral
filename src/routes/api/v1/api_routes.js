const express = require('express')
const router = express.Router()
const {lookupService} = require('../../../configure-services.js');

router.get('/devices/:deviceId/sensors', (req, res) => {
    res.type('json');
    const deviceId = req.params.deviceId;
    
    lookupService('storage').then(storage => {
        // get all sensors
        return storage.getSensors();

    }).then(allSensors => {
        const sensorsForDevice = Object.values(allSensors)
            .filter(sensor => sensor.device && sensor.device.deviceId === deviceId)
            .reduce((prev, sensor) => {
                delete sensor.device;
                prev[sensor.sensorId] = sensor;
                return prev;
            }, {});
        res.status(200).send(sensorsForDevice);
        
    }).catch(err => {
        console.log('Unable to lookup storage service');
        res.status(500).send({'error': true, 'message': err.message});
    })
})

router.get('/devices/?*?', (req, res) => {
    res.type('json');
    const params = req.params[0];
    const deviceId = params ? params.split('/')[0] : undefined;
    
    lookupService('storage').then(storage => {
        if (!deviceId) {
            // get all devices
            return storage.getDevices();
        } else {
            // get single device
            return storage.getDeviceById(deviceId);    
        }

    }).then(devices => {
        res.status(200).send(devices);

    }).catch(err => {
        console.log('Unable to lookup storage service');
        res.status(500).send({'error': true, 'message': err.message});
    })
})

router.get('/sensors', (req, res) => {
    res.type('json');
    let queryKey = req.query.queryKey;
    let queryValue = req.query.queryValue;
    
    lookupService('storage').then(storage => {
        // get all sensors
        return storage.getSensors();

    }).then(allSensors => {
        // delete device info
        Object.values(allSensors).forEach(sensor => delete sensor.device);

        // see if we should send all sensors
        if (!queryKey || !queryValue) {
            return res.status(200).send(allSensors);
        }
        const filteredSensors = Object.values(allSensors)
            .reduce((prev, sensor) => {
                if (sensor[queryKey] === queryValue) prev.push(sensor);
                return prev;
            }, []);
        if (!filteredSensors.length) {
            res.status(404).send({'error': true, 'message': `Unable to find sensor(s) matching ${queryKey}=${queryValue}`})
        } else {
            res.status(200).send(filteredSensors.length === 1 ? filteredSensors[0] : filteredSensors);
        }
        
    }).catch(err => {
        console.log('Unable to lookup storage service');
        res.status(500).send({'error': true, 'message': err.message});
    })
})

module.exports = router;
