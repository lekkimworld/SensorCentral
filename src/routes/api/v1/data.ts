import * as express from 'express';
import { BaseService, ControlMessageTypes, IngestedControlMessage, IngestedDeviceMessage, 
	IngestedSensorMessage, SensorSample, HttpException, BackendIdentity } from '../../../types';
import { LogService } from '../../../services/log-service';
import { EventService } from '../../../services/event-service';
import { StorageService } from '../../../services/storage-service';
const {lookupService} = require('../../../configure-services');
import constants from "../../../constants";
import {formatDate} from "../../../utils";
import moment from 'moment';
import { ensureScopeFactory, hasScope } from '../../../middleware/ensureScope';
import uuid from 'uuid';

const router = express.Router();

const postControlEvent = (eventSvc : EventService, logSvc : LogService, payload : IngestedControlMessage) => {
	eventSvc.publishQueue(constants.QUEUES.CONTROL, payload).then(resp => {
		logSvc.debug(`Posted message (<${JSON.stringify(resp.data)}>) to exchange <${resp.exchangeName}> and key <${resp.routingKey}>`)
	}).catch(err => {
		logSvc.error(`Could NOT post message (<${JSON.stringify(err.data)}>) to exchange <${err.exchangeName}> and key <${err.routingKey}>`, err)
	})
}

// set default response type to json
//@ts-ignore
router.use((req, res, next) => {
    res.type('json');
    next();
})

interface SensorDataObject {
	readonly sensorId : string;
	readonly sensorValue : number;
}

router.get("/samples/:sensorId/:samples", (req, res) => {	
	const user = res.locals.user;
	const samples = Number.parseInt(req.params.samples, 10) ? Number.parseInt(req.params.samples, 10) : 100
	lookupService(StorageService.NAME).then((storageService : StorageService) => {
		return storageService.getLastNSamplesForSensor(user, req.params.sensorId, samples);
	}).then((samples : SensorSample[]) => {
		res.send(samples);
	}).catch((err : Error) => {
		res.status(404).send({"error": true, "message": `Unable to find sensor (${err.message})`});
	})
})

router.use(ensureScopeFactory(constants.JWT.SCOPE_SENSORDATA));

router.post("/samples", (req, res, next) => {
	lookupService([LogService.NAME, EventService.NAME, StorageService.NAME]).then((services : BaseService[]) => {
		const logService = services[0] as LogService;
		const eventService = services[1] as EventService;
		const storageService = services[2] as StorageService;

		const user = res.locals.user;
		const body = req.body
		const deviceId = body.deviceId;

		// validate
		const str_dt = body.dt;
		const value = body.value;
		const id = body.id;
		if (!id) return next(new HttpException(417, "Missing id"));
		if (!deviceId) return next(new HttpException(417, "Missing device id"));
		if (!value || Number.isNaN(value)) return next(new HttpException(417, "Missing value or value is not a number"));
		if (!str_dt || !str_dt.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/)) return  res.status(417).send({"error": true, "message": "Missing sample date/time or date/time is not in ISO8601 format"});
		
		// ensure we know the device still (device may have an JWT for a deleted device)
		storageService.getDevice(user, deviceId).then(() => {
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
				id, 
				value, 
				"dt": str_dt,
				"dt_string": formatDate(moment.utc(str_dt))
			});

		}).catch((err:Error) => {
			logService.warn(`Unable to send sample for sensor with ID <${id}> to queue...`);
			return next(new HttpException(500, `Unable to add sample to database (${err.message})`, err));
		})
		
	}).catch((err:Error) => {
		return next(new HttpException(500, `Unable to find required services (${err.message})`, err));
	})
	
})

/**
 * Route used to ingest data from sensors.
 * 
 */
router.post("/", async (req, res, next) => {
	const services = await lookupService([LogService.NAME, StorageService.NAME, EventService.NAME])
	const logService = services[0] as LogService;
	const storageService = services[1] as StorageService;
	const eventService = services[2] as EventService;

	const body = req.body
	const user = res.locals.user as BackendIdentity;
	
	// basic validation and get device id
	logService.debug("Starting basic validation of payload");
	if (Array.isArray(body)) return next(new HttpException(417, "Excepted object"));
	if (!body.hasOwnProperty("deviceId")) return next(new HttpException(417, "Missing deviceId-property"));
	const deviceId : string = body.deviceId;
	logService.debug(`Extracted deviceId from payload <${deviceId}>`);
	
	// validate API user subject matches the payload device id and raise an error if 
	// not or user does not have admin scope
	if (deviceId !== user.identity.callerId && !hasScope(user, constants.JWT.SCOPE_ADMIN)) {
		logService.warn(`Caller sent a payload subject <${deviceId}> which is different from JWT subject <${user.identity.callerId}>`);
		return next(new HttpException(401, "Attempt to post data for device blocked as api context is for another device"));
	}
	
	// payload validate
	logService.debug("Starting extended validation of payload");
	if (!body.hasOwnProperty("msgtype")) return next(new HttpException(417, "Missing msgtype-property"));
	if (!["data","control"].includes(body.msgtype)) return next(new HttpException(417, "msgtype-property must be data or control"));
	if (!body.hasOwnProperty("data")) return next(new HttpException(417, "Missing data-property"));

	const msgtype = body.msgtype;
	if (msgtype === "control") {
		if (Array.isArray(body.data) || typeof body.data !== "object") {
			return next(new HttpException(417, "For msgtype=control the data-property must be an object"));
		}
	} else if (msgtype === "data") {
		if (!Array.isArray(body.data)) {
			return next(new HttpException(417, "For msgtype=data the data-property must be an array of objects"));
		}
		for (const idx in body.data) {
			const elem = body.data[idx];
			if (typeof elem !== "object")return next(new HttpException(417, "For msgtype=data the data-property must be an array of objects"));
			const obj = elem as object;
			if (!obj.hasOwnProperty("sensorId") || !obj.hasOwnProperty("sensorValue")) {
				return next(new HttpException(417, "For msgtype=data the objects in the data-property must have a sensorId and sensorValue property"));
			}
			const objSensorData = obj as SensorDataObject;
			if (typeof objSensorData.sensorId !== "string" || typeof objSensorData.sensorValue !== "number") {
				return next(new HttpException(417, "sensorId must be a string and sensorValue a number"));
			}
		}
	}

	let device;
	try {
		// ensure we know the device still (device may have an JWT for a deleted device)
		device = await storageService.getDevice(user, deviceId);
	} catch (err) {
		logService.warn(`Unable to find device by ID <${deviceId}> in database - maybe unknown...`);
		return next(new HttpException(500, `Unable to find device from payload or other error (${err.message})`, err));
	}
	
	// acknowledge post to caller
	const str_body_received = JSON.stringify(body, undefined, 2)
	res.set('Content-Type', 'text/plain').send(`Thank you - you posted: ${str_body_received}\n`).end()
	logService.debug(`Completed validation of payload: ${str_body_received}`);
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
		postControlEvent(eventService, logService, payload);

	} else if (msgtype === 'data') {
		const dataArray = body.data as SensorDataObject[];

		// publish a device event
		const payload : IngestedDeviceMessage = {
			"id": deviceId
		}
		const resp = await eventService.publishQueue(constants.QUEUES.DEVICE, payload)
		logService.debug(`Posted message (<${JSON.stringify(resp.data)}>) to queue <${resp.exchangeName}>`);
			
		// if there is no elements in the data array send a control event to signal 
		if (dataArray.length === 0) {
			postControlEvent(eventService, logService, {
				"type": ControlMessageTypes.noSensorData,
				"id": deviceId
			} as IngestedControlMessage);
		} else {
			// send out a sensor reading message per reading
			dataArray.forEach(element => {
				const payload : IngestedSensorMessage = {
					'value': element.sensorValue,
					'id': element.sensorId,
					"deviceId": deviceId
				}
				
				eventService.publishQueue(constants.QUEUES.SENSOR, payload).then(() => {
					logService.debug(`Published message to ${constants.QUEUES.SENSOR}`);
				}).catch(err => {
					logService.error(`Unable to publish message to ${constants.QUEUES.SENSOR}`, err);
				})
			})
		}
	}
})

router.post("/power", async (req, res) => {
	const obj = req.body;

	const storage = await lookupService(StorageService.NAME) as StorageService;
	const data : Array<any> = await Promise.all(obj.dates.map((d : string) => storage.getPowerData(d)));

	let str = "";
	if (obj.type === "csv") {
		const colA = [""];
		colA.push(...data[0].map((v : any) => v.x));
		const colsN = data.reduce((cols : Array<Array<string>>, d : any, idx : number) => {
			if (!d)  return cols;
			const col = [];
			col.push(`foo${idx}`);
			col.push(...d.map((v : any) => v.y));
			cols.push(col);
			return cols;
		}, []);
		
		for (let i=0; i<colA.length; i++) {
			str += colA[i];
			str += ";";
			for (let k=0; k<colsN.length; k++) {
				str += colsN[k][i];
				str += ";";
			}
			str += "\n";
		}
	} else {
		// stay in json
		str = JSON.stringify(data);
	}
	
	// set in redis
	const key = uuid();
	storage.setTemporaryData(key, 120, str);

	// respond
	res.status(200).type("json").send({
		"downloadKey": key
	});
})

export default router;
