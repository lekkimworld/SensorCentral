import express from 'express';
import decodeSmartmeBuffer, {Smartme} from "smartme-protobuf-parser";
import { StorageService } from '../services/storage-service';
import { HttpException, IngestedSensorMessage } from '../types';
import { EventService } from 'src/services/event-service';
import constants from '../constants';
import { LogService } from '../services/log-service';
const {lookupService} = require('../configure-services');

const router = express.Router();

router.post('/:clientId', async (req, res, next) => {
    // get storage service
    const services = await lookupService(["storage", "event", "log"]);
    const storage = services[0] as StorageService;
    const eventService = services[1] as EventService;
    const log = services[2] as LogService;

    // get the client ID from the URL and get associated credentials
    const clientId = req.params.clientId;
    const smartmeInfo = await storage.getSmartmeInfoForClient(clientId);

    // get auth header and verify
    const authHeader = req.headers.authorization;
    if (!authHeader) return next(new HttpException(417, "Missing authorization header"));
    if (authHeader !== smartmeInfo.authHeader) return next(new HttpException(401, "Unauthorized"));

    // get the buffer from the body
    const buf : Buffer = req.body;

    // respond
    res.status(200).send("OK").end();

    // decode
    decodeSmartmeBuffer(buf).then(async (samples) => {
        // loop and send events
        samples.forEach(sample => {
            // ignore if not from the known sensor (powermeter)
            log.debug(`Received sample from powermeter deviceId <${sample.deviceId}>`);
            if (sample.deviceId !== smartmeInfo.sensorId) {
                log.warn(`Ignoring powermeter sample as deviceId <${sample.deviceId}> does NOT match expected sensorId <${smartmeInfo.sensorId}>`);
                return;
            }

            // send event to persist as sensor_data
            eventService.publishQueue(constants.QUEUES.SENSOR, {
                "deviceId": smartmeInfo.deviceId,
                "id": smartmeInfo.sensorId,
                "dt": sample.dt.toISOString(),
                "value": sample.getValue(Smartme.Obis.ActiveEnergyTotalImport)
            } as IngestedSensorMessage);
        })
    })
})

export default router;