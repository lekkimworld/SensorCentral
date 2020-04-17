import * as express from 'express';
const {lookupService} = require('../configure-services');
import { BaseService } from '../types';
import { StorageService } from '../services/storage-service';
import { LogService } from '../services/log-service';

const router = express.Router();

//@ts-ignore
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
                if (!sensor.device) return;
                if (!sensor.device.house) return;
                const sensorName = sensor.name;
                const sensorLabel = sensor.label;
                const sensorType = sensor.type;
                const deviceId = sensor.device.id;
                const deviceName = sensor.device.name;
                const houseId = sensor.device.house.id;
                const houseName = sensor.device.house.name;
                buffer.push(`sensor\{houseId="${houseId}",houseName="${houseName}",deviceId="${deviceId}",deviceName="${deviceName}",sensorId="${sensor.id}",sensorName="${sensorName}",sensorLabel="${sensorLabel}",sensorType="${sensorType}"\} ${sensor.value}`);
            })
            
            // get devices
            return storage.getKnownDevicesStatus();

        }).then(devices => {
            // traverse and process each device restart or watchdog event in turn
            devices.filter(d => d.house).forEach(device => {
                buffer.push(`device\{houseId="${device.house.id}",houseName="${device.house.name}",deviceId="${device.id}",deviceName="${device.name}",type="restart"\} ${device.restarts ? device.restarts : 0}`);
                buffer.push(`device\{houseId="${device.house.id}",houseName="${device.house.name}",deviceId="${device.id}",deviceName="${device.name}",type="watchdog"\} ${device.watchdogResets ? device.watchdogResets : 0}`);
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
