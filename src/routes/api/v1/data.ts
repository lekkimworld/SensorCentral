import * as express from 'express';
import { BaseService, ControlMessageTypes, IngestedControlMessage, IngestedDeviceMessage, IngestedSensorMessage, APIUserContext, Device } from '../../../types';
import { LogService } from '../../../services/log-service';
import { EventService } from '../../../services/event-service';
import { StorageService } from '../../../services/storage-service';
const {lookupService} = require('../../../configure-services');
import {constants} from "../../../constants";

const router = express.Router();

// set default response type to json
router.use((req, res, next) => {
    res.type('json');
    next();
})

interface SensorDataObject {
	readonly sensorId : string;
	readonly sensorValue : number;
}

router.post("/", (req, res) => {
    // ensure correct scope
    const apictx = res.locals.api_context as APIUserContext;
    if (!apictx.hasScope(constants.DEFAULTS.API.JWT.SCOPE_SENSORDATA)) {
        return res.status(401).send({"error": true, "message": `Unauthorized - missing ${constants.DEFAULTS.API.JWT.SCOPE_SENSORDATA} scope`});
    }
	const body = req.body

	// basic validateion and get device id
	if (Array.isArray(body)) return res.status(417).send({"error": true, "message": "Excepted object"});
	if (!body.hasOwnProperty("deviceId")) return res.status(417).send({"error": true, "message": "Missing deviceId-property"});
	const deviceId : string = body.deviceId;

	// validate API user subject matches the payload device id
	if (deviceId !== apictx.subject) {
		return res.status(401).send({
			"error": true,
			"message": "Attempt to post data for device blocked as api context is for another device"
		})
	}

	// payload validate
	if (!body.hasOwnProperty("msgtype")) return res.status(417).send({"error": true, "message": "Missing msgtype-property"});
	if (!["data","control"].includes(body.msgtype)) return res.status(417).send({"error": true, "message": "msgtype-property must be data or control"});
	if (!body.hasOwnProperty("data")) return res.status(417).send({"error": true, "message": "Missing data-property"});

	const msgtype = body.msgtype;
	if (msgtype === "control") {
		if (Array.isArray(body.data) || typeof body.data !== "object") {
			return res.status(417).send({"error": true, "message": "For msgtype=control the data-property must be an object"});
		}
	} else if (msgtype === "data") {
		if (!Array.isArray(body.data)) {
			return res.status(417).send({"error": true, "message": "For msgtype=data the data-property must be an array of objects"});
		}
		for (const idx in body.data) {
			const elem = body.data[idx];
			if (typeof elem !== "object")return res.status(417).send({"error": true, "message": "For msgtype=data the data-property must be an array of objects"});
			const obj = elem as object;
			if (!obj.hasOwnProperty("sensorId") || !obj.hasOwnProperty("sensorValue")) {
				return res.status(417).send({"error": true, "message": "For msgtype=data the objects in the data-property must have a sensorId and sensorValue property"});
			}
			const objSensorData = obj as SensorDataObject;
			if (typeof objSensorData.sensorId !== "string" || typeof objSensorData.sensorValue !== "number") {
				return res.status(417).send({"error": true, "message": "sensorId must be a string and sensorValue a number"});
			}
		}
	}


	// acknowledge post to caller
	const str_body_received = JSON.stringify(body, undefined, 2)
	res.set('Content-Type', 'text/plain').send(`Thank you - you posted: ${str_body_received}\n`).end()

	// lookup services
	lookupService(['log', 'storage']).then((svcs : BaseService[]) => {
		// get servicesx
		const logSvc = svcs[0] as LogService;
		const storageSvc = svcs[1] as StorageService;
		logSvc.debug(`Received data: <${str_body_received}>`);

		// ensure we know the device still (device may have an JWT for a deleted device)
		return Promise.all([
			storageSvc.getDeviceById(deviceId), 
			lookupService('log'), 
			lookupService('event')
		]);
	}).then((data : any) => {
		// get data obj if there
		const device = data[0] as Device;
		const logSvc = data[1] as LogService;
		const eventSvc = data[2] as EventService;
		const dataObj = body.data || undefined;
		
		// inspect message type
		if (msgtype === 'control') {
			const dataObj = body.data as {[key:string] : string};

			// control message - get type
			let type = ControlMessageTypes.unknown;
			if (dataObj.hasOwnProperty("restart")) {
				type = ControlMessageTypes.restart;
			}  else if (dataObj.hasOwnProperty("watchdogReset")) {
				type = ControlMessageTypes.watchdogReset;
			}

			// create payload and publish to queue
			const payload : IngestedControlMessage = {
				"type": type,
				"id": deviceId
			}
			eventSvc.publishQueue(constants.QUEUES.CONTROL, payload).then(resp => {
				logSvc.debug(`Posted message (<${JSON.stringify(resp.data)}>) to exchange <${resp.exchangeName}> and key <${resp.routingKey}>`)
			}).catch(err => {
				logSvc.error(`Could NOT post message (<${JSON.stringify(err.data)}>) to exchange <${err.exchangeName}> and key <${err.routingKey}>`, err)
			})

		} else if (msgtype === 'data') {
			const dataArray = body.data as SensorDataObject[];

			// publish a device event
			const payload : IngestedDeviceMessage = {
				"id": deviceId
			}
			eventSvc.publishQueue(constants.QUEUES.DEVICE, payload).then(resp => {
				logSvc.debug(`Posted message (<${JSON.stringify(resp.data)}>) to queue <${resp.exchangeName}>`);
				const msg = resp.data as IngestedDeviceMessage;

				// send out a sensor reading message per reading
				dataArray.forEach(element => {
					const payload : IngestedSensorMessage = {
						'value': element.sensorValue,
						'id': element.sensorId,
						"deviceId": deviceId
					}
					eventSvc.publishQueue(constants.QUEUES.SENSOR, payload).then(resp => {
						logSvc.debug(`Published message to ${constants.QUEUES.SENSOR}`);
					}).catch(err => {
						logSvc.error(`Unable to publish message to ${constants.QUEUES.SENSOR}`, err);
					})
				})
				

			}).catch(err => {
				// logSvc.error(`Could NOT post message (<${JSON.stringify(err.data)}>) to queue <${err.exchangeName}>`, err)
			})
		}
	}).catch((err:Error) => {
		res.status(500).send({
			"error": true,
			"message": `Unable to find device from payload or other error (${err.message})`
		})
    })
})

export default router;
