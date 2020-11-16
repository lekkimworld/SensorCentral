import express from 'express';
const {lookupService} = require('../../../configure-services');
import { BaseService, Sensor, RedisSensorMessage, Device, RedisDeviceMessage } from '../../../types';
import { StorageService } from '../../../services/storage-service';
import { LogService } from '../../../services/log-service';
import { QueueListenerService } from '../../../services/queuelistener-service';

const router = express.Router();

//@ts-ignore
router.get("/", (req, res) => {
    res.set({
        'Content-Type': 'text/plain'
    })

    // get user
    const user = res.locals.user;
    
    lookupService([StorageService.NAME, LogService.NAME, QueueListenerService.NAME]).then((svcs : BaseService[]) => {
        // define common buffer
        const storage = svcs[0] as StorageService;
        const log = svcs[1] as LogService;
        const queue = svcs[2] as QueueListenerService;
        const buffer : string[] = [];

        // get sensors from storage service
        storage.getAllSensors(user).then(sensors => {
            const sensorIds = sensors.map(s => s.id);
            return Promise.all([Promise.resolve(sensors), queue.getRedisSensorMessage(...sensorIds)]);
        }).then(data => {
            const sensors = data[0] as Sensor[];
            const redisData = data[1] as RedisSensorMessage[];

            // traverse and process each sensor in turn
            sensors.forEach((sensor, idx) => {
                const redisObj = redisData[idx];
                if (!redisObj) return;
                if (redisObj.value === Number.MIN_VALUE) return;
                if (!sensor.device) return;
                if (!sensor.device.house) return;

                const sensorName = sensor.name;
                const sensorLabel = sensor.label;
                const sensorType = sensor.type;
                const deviceId = sensor.device.id;
                const deviceName = sensor.device.name;
                const houseId = sensor.device.house.id;
                const houseName = sensor.device.house.name;
                buffer.push(`sensor\{houseId="${houseId}",houseName="${houseName}",deviceId="${deviceId}",deviceName="${deviceName}",sensorId="${sensor.id}",sensorName="${sensorName}",sensorLabel="${sensorLabel}",sensorType="${sensorType}"\} ${redisObj.value}`);
            })

            // get devices
            return storage.getAllDevices(user);

        }).then(devices => {
            const deviceIds = devices.map(d => d.id);
            return Promise.all([Promise.resolve(devices), queue.getRedisDeviceMessage(...deviceIds)]);

        }).then(data => {
            const devices = data[0] as Device[];
            const redisData = data[1] as RedisDeviceMessage[];

            devices.forEach((device, idx) => {
                const redisObj = redisData[idx];
                if (!redisObj) return;
                if (!device.house) return;
                
                buffer.push(`device\{houseId="${device.house.id}",houseName="${device.house.name}",deviceId="${device.id}",deviceName="${device.name}",type="restart"\} ${redisObj.restarts || 0}`);
                buffer.push(`device\{houseId="${device.house.id}",houseName="${device.house.name}",deviceId="${device.id}",deviceName="${device.name}",type="watchdog"\} ${redisObj.watchdogResets || 0}`);
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
