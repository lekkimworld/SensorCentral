import * as express from 'express';
import { BaseService, ControlMessageTypes, IngestedControlMessage, IngestedDeviceMessage, IngestedSensorMessage, APIUserContext, Device, SensorSample } from '../../../types';
import { LogService } from '../../../services/log-service';
import { EventService } from '../../../services/event-service';
import { StorageService } from '../../../services/storage-service';
const {lookupService} = require('../../../configure-services');
import {constants} from "../../../constants";
import moment from 'moment';

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

router.get("/samples/:sensorId/:samples", (req, res) => {	
	const samples = Number.parseInt(req.params.samples, 10) ? Number.parseInt(req.params.samples, 10) : 100
	lookupService("storage").then((storageService : StorageService) => {
		return storageService.getLastNSamplesForSensor(req.params.sensorId, samples);
	}).then((samples : SensorSample[]) => {
		res.send(samples);
	}).catch((err : Error) => {
		res.status(404).send({"error": true, "message": `Unable to find sensor (${err.message})`});
	})
})

router.post("/samples", (req, res) => {
	lookupService(["log", "event", "storage"]).then((services : BaseService[]) => {
		const logService = services[0] as LogService;
		const eventService = services[1] as EventService;
		const storageService = services[2] as StorageService;

		// ensure correct scope
		const apictx = res.locals.api_context as APIUserContext;
		if (!apictx.hasScope(constants.DEFAULTS.API.JWT.SCOPE_SENSORDATA)) {
			logService.warn(`Calling user does not have required scopes - has scopes <${apictx.scopes.join()}> - needs <${constants.DEFAULTS.API.JWT.SCOPE_SENSORDATA}>`);
			return res.status(401).send({"error": true, "message": `Unauthorized - missing ${constants.DEFAULTS.API.JWT.SCOPE_SENSORDATA} scope`});
		} else {
			logService.debug(`Confirmed caller has <${constants.DEFAULTS.API.JWT.SCOPE_SENSORDATA}> scope`)
		}
		const body = req.body
		const deviceId = body.deviceId;

		// validate
		const str_dt = body.dt;
		const value = body.value;
		const id = body.id;
		if (!id) return res.status(417).send({"error": true, "message": "Missing id"});
		if (!deviceId) return res.status(417).send({"error": true, "message": "Missing device id"});
		if (!value || Number.isNaN(value)) return res.status(417).send({"error": true, "message": "Missing value or value is not a number"});
		if (!str_dt || !str_dt.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/)) return  res.status(417).send({"error": true, "message": "Missing sample date/time or date/time is not in ISO8601 format"});
		
		// ensure we know the device still (device may have an JWT for a deleted device)
		storageService.getDeviceById(deviceId).then((device : Device) => {
			const queueObj = {
				id,
				value,
				deviceId,
				dt: str_dt
			} as IngestedSensorMessage;
			return eventService.publishQueue(constants.QUEUES.SENSOR, queueObj);

		}).then(resp => {
			logService.debug(`Posted message (<${JSON.stringify(resp.data)}>) to queue <${resp.exchangeName}>`);
			return res.status(201).send({
				id, value, deviceId, "dt": str_dt
			});

		}).catch((err:Error) => {
			logService.warn(`Unable to send sample for sensor with ID <${id}> to queue...`);
			res.status(500).send({
				"error": true,
				"message": `Unable to add sample to database (${err.message})`
			})
		})
	}).catch((err:Error) => {
		return res.status(500).send({"error": true, "message": `Unable to find required services (${err.message})`});
	})
})

router.post("/", (req, res) => {
	lookupService(["log", "storage", "event"]).then((services : BaseService[]) => {
		const logService = services[0] as LogService;
		const storageService = services[1] as StorageService;
		const eventService = services[2] as EventService;

		// ensure correct scope
		const apictx = res.locals.api_context as APIUserContext;
		if (!apictx.hasScope(constants.DEFAULTS.API.JWT.SCOPE_SENSORDATA)) {
			logService.warn(`Calling user does not have required scopes - has scopes <${apictx.scopes.join()}> - needs <${constants.DEFAULTS.API.JWT.SCOPE_SENSORDATA}>`);
			return res.status(401).send({"error": true, "message": `Unauthorized - missing ${constants.DEFAULTS.API.JWT.SCOPE_SENSORDATA} scope`});
		} else {
			logService.debug(`Confirmed caller has <${constants.DEFAULTS.API.JWT.SCOPE_SENSORDATA}> scope`)
		}
		const body = req.body
	
		// basic validation and get device id
		logService.debug("Starting basic validation of payload");
		if (Array.isArray(body)) return res.status(417).send({"error": true, "message": "Excepted object"});
		if (!body.hasOwnProperty("deviceId")) return res.status(417).send({"error": true, "message": "Missing deviceId-property"});
		const deviceId : string = body.deviceId;
		logService.debug(`Extracted deviceId from payload <${deviceId}>`);
	
		// validate API user subject matches the payload device id
		if (deviceId !== apictx.subject) {
			logService.warn(`Caller sent a payload subject <${deviceId}> which is different from JWT subject <${apictx.subject}>`);
			return res.status(401).send({
				"error": true,
				"message": "Attempt to post data for device blocked as api context is for another device"
			})
		}
	
		// payload validate
		logService.debug("Starting extended validation of payload");
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

		// ensure we know the device still (device may have an JWT for a deleted device)
		storageService.getDeviceById(deviceId).then((device : Device) => {
			// acknowledge post to caller
			const str_body_received = JSON.stringify(body, undefined, 2)
			res.set('Content-Type', 'text/plain').send(`Thank you - you posted: ${str_body_received}\n`).end()
			logService.debug(`Completed validation of payload: ${str_body_received}`);

			const dataObj = body.data || undefined;
			logService.debug(`Retrieved device with ID <${device.id}> from database`);
			
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
				eventService.publishQueue(constants.QUEUES.CONTROL, payload).then(resp => {
					logService.debug(`Posted message (<${JSON.stringify(resp.data)}>) to exchange <${resp.exchangeName}> and key <${resp.routingKey}>`)
				}).catch(err => {
					logService.error(`Could NOT post message (<${JSON.stringify(err.data)}>) to exchange <${err.exchangeName}> and key <${err.routingKey}>`, err)
				})

			} else if (msgtype === 'data') {
				const dataArray = body.data as SensorDataObject[];

				// publish a device event
				const payload : IngestedDeviceMessage = {
					"id": deviceId
				}
				eventService.publishQueue(constants.QUEUES.DEVICE, payload).then(resp => {
					logService.debug(`Posted message (<${JSON.stringify(resp.data)}>) to queue <${resp.exchangeName}>`);
					const msg = resp.data as IngestedDeviceMessage;

					// send out a sensor reading message per reading
					dataArray.forEach(element => {
						const payload : IngestedSensorMessage = {
							'value': element.sensorValue,
							'id': element.sensorId,
							"deviceId": deviceId
						}
						eventService.publishQueue(constants.QUEUES.SENSOR, payload).then(resp => {
							logService.debug(`Published message to ${constants.QUEUES.SENSOR}`);
						}).catch(err => {
							logService.error(`Unable to publish message to ${constants.QUEUES.SENSOR}`, err);
						})
					})
					

				}).catch(err => {
					logService.error(`Could NOT post message (<${JSON.stringify(err.data)}>) to queue <${err.exchangeName}>`, err)
				})
			}
		}).catch((err:Error) => {
			logService.warn(`Unable to find device by ID <${deviceId}> in database - maybe unknown...`);
			res.status(500).send({
				"error": true,
				"message": `Unable to find device from payload or other error (${err.message})`
			})
		})
	})
})

export default router;
