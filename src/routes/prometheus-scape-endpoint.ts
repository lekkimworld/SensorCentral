import * as express from 'express';
const {lookupService} = require('../configure-services');
import { BaseService } from '../types';
import { StorageService } from '../services/storage-service';
import { LogService } from '../services/log-service';

const router = express.Router();
router.get("/", (req, res) => {
    res.set({
        'Content-Type': 'text/plain'
    })

    lookupService(['storage', 'log']).then((svcs : BaseService[]) => {
        // define common buffer
        const storage = svcs[0] as StorageService;
        const log = svcs[1] as LogService;
        const buffer : string[] = [];

        // get sensors from storage service
        storage.getKnownSensorsWithRecentReadings().then(sensors => {
            // traverse and process each sensor in turn
            sensors.forEach(sensor => {
                if (!sensor.value || sensor.value === Number.MIN_VALUE) return;
                let fixedName = sensor.label ? sensor.label : `nolabel${sensor.id}`;
                let deviceId = sensor.device && sensor.device.id ? sensor.device.id : 'unknown';
                let deviceName = sensor.device && sensor.device.name ? sensor.device.name : 'unknown';
                buffer.push(`sensor_${fixedName}\{sensorId="${sensor.id}",deviceId="${deviceId}",deviceName="${deviceName}"\} ${sensor.value}`);
            })
            
            // get devices
            return storage.getKnownDevicesStatus();

        }).then(devices => {
            // traverse and process each device restart or watchdog event in turn
            devices.forEach(device => {
                buffer.push(`device_restart\{deviceId="${device.id}",deviceName=\"${device.name}\"\} ${device.restarts ? device.restarts : 0}`)
            })
            devices.forEach(device => {
                buffer.push(`device_watchdog_reset\{deviceId="${device.id}",deviceName=\"${device.name}\"\} ${device.watchdogResets ? device.watchdogResets : 0}`)
            })

            return Promise.resolve();

        }).then(() => {
            // send response
            res.status(200).send(buffer.join('\n')).end()

        }).catch(err => {
            // send error response
            log.error('Unable to get Prometheus scrape target data', err);
            res.status(500).end();
        })

    }).catch((err : Error) => {
        res.status(500).send(`Required storage-service not available (${err.message})`).end()
    })
})

export default router;
