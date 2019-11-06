import * as express from 'express';
import { BaseService, Sensor, RedisSensorMessage } from '../../../types';
import { StorageService } from '../../../services/storage-service';
import { stringify } from 'querystring';
import { read } from 'fs';
import { LogService } from '../../../services/log-service';
import * as prometheus from "../../../prometheus-export";
import Moment from 'moment';
import moment = require("moment");
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
        res.status(404).send({'error': true, 'message': err.message});
    })
})

router.get("/excel/:sensorLabel/:period/:step", (req, res) => {
    // get sensor label
    const sensorLabel = req.params.sensorLabel;
    const period = req.params.period;
    let start : Moment.Moment;
    let end : Moment.Moment; 
    let step : string | undefined = req.params.step;
    if (period === "last24hrs") {
        start = moment().set("minute", 0).set("second", 0).set("millisecond", 0).add(-24, "hour").utc();
        end = moment().set("minute", 0).set("second", 0).set("millisecond", 0).utc();
    } else if (period === "lastweek") {
        start = moment().set("minute", 0).set("second", 0).set("millisecond", 0).add(-1, "week").utc();
        end = moment().set("minute", 0).set("second", 0).set("millisecond", 0).utc();
    } else {
        return res.status(417).end();
    }
    prometheus.fetchData({
        "query": `sensor_${sensorLabel}`,
        "start": start,
        "end": end,
        "step": step
    }).then((dataset : Array<prometheus.ExportedSensorValue>) => {
        const buf = prometheus.createExcelWorkbook(dataset);
        const timestamp = moment().utc().format(prometheus.ISO8601_DATETIME_FORMAT);
        res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.set("Content-Disposition", `attachment; filename="sensorcentral_export_${sensorLabel}_${timestamp}.xlsx"`);
        res.send(buf).end();
    })
})

export default router;
