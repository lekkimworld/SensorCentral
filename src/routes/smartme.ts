import express from 'express';
import decodeSmartmeBuffer, {Smartme} from "smartme-protobuf-parser";
import { StorageService } from '../services/storage-service';
import { HttpException, IngestedSensorMessage, IngestedDeviceMessage } from '../types';
import { EventService } from '../services/event-service';
import constants from '../constants';
import { LogService } from '../services/log-service';
const {lookupService} = require('../configure-services');
import { verifyPayload } from "../smartme-signature";

const router = express.Router();

router.post('/:clientId([a-zA-Z0-9+/=.]+)', async (req, res, next) => {
    // get storage service
    const services = await lookupService([StorageService.NAME, EventService.NAME, LogService.NAME]);
    const storage = services[0] as StorageService;
    const eventService = services[1] as EventService;
    const log = services[2] as LogService;

    // get the client ID from the URL and verify
    const clientId = req.params.clientId;
    try {
        var signatureData = verifyPayload(clientId);
    } catch (err) {
        return next(new HttpException(417, err.message));
    }
    
    // calc basic auth header from data and verify
    const acceptedAuth = `Basic ${Buffer.from(`${signatureData.username}:${signatureData.password}`).toString('base64')}`;
    const authHeader = req.headers.authorization;
    if (!authHeader) return next(new HttpException(417, "Missing authorization header"));
    if (authHeader !== acceptedAuth) return next(new HttpException(401, "Unauthorized"));

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
            log.debug(`Received powermeter sample: ${JSON.stringify(sample)}`);
            if (sample.deviceId !== signatureData.sensorId) {
                log.warn(`Ignoring powermeter sample as deviceId <${sample.deviceId}> does NOT match expected sensorId <${signatureData.sensorId}>`);
                return;
            }
            if (sample.dt.getFullYear() < constants.SMARTME.CUTOFF_YEAR) {
                log.warn(`Ignoring powermeter sample as timestamp <${sample.dt.toISOString()}> is before ${constants.SMARTME.CUTOFF_YEAR} (spurious sample)`);
                return;
            }

            // publish a device event to feed watchdog
            const payload : IngestedDeviceMessage = {
                "id": signatureData.deviceId
            }
            eventService.publishQueue(constants.QUEUES.DEVICE, payload).then(() => {
                // send event to persist as sensor_data
                eventService.publishQueue(constants.QUEUES.SENSOR, {
                    "deviceId": signatureData.deviceId,
                    "id": signatureData.sensorId,
                    "dt": sample.dt.toISOString(),
                    "value": sample.getValue(Smartme.Obis.ActiveEnergyTotalImport)
                } as IngestedSensorMessage);

                // persist sample
                storage.persistPowermeterReading(sample);
            })
        })
    })
})

export default router;