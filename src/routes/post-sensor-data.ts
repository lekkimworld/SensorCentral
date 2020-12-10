import * as express from 'express';
const services = require('../configure-services');
import {EventService} from "../services/event-service";
import constants from "../constants";
import { LogService } from '../services/log-service';
import { BaseService, IngestedControlMessage, IngestedDeviceMessage, IngestedSensorMessage, ControlMessageTypes, HttpException } from '../types';
import { StorageService } from 'src/services/storage-service';
import { IdentityService } from 'src/services/identity-service';

const router = express.Router();

const postControlEvent = (eventSvc : EventService, logSvc : LogService, payload : IngestedControlMessage) => {
	eventSvc.publishQueue(constants.QUEUES.CONTROL, payload).then(resp => {
		logSvc.debug(`Posted message (<${JSON.stringify(resp.data)}>) to exchange <${resp.exchangeName}> and key <${resp.routingKey}>`)
	}).catch(err => {
		logSvc.error(`Could NOT post message (<${JSON.stringify(err.data)}>) to exchange <${err.exchangeName}> and key <${err.routingKey}>`, err)
	})
}

router.post('/', (req, res, next) => {
	// get data and see if array
	const body = req.body
	const postObj : any = (function()  {
		if (!body) {
			return undefined
		}
		if (Array.isArray(body)) {
			// received old data format
			return {
				'msgtype': 'data',
				'data': body
			}
		} else if (!('msgtype' in body)) {
			// it's an object but without msgtype
			return {
				'msgtype': 'data',
				'data': [body]
			}
		} else {
			// received new data format
			return body
		}
	})() as object
	
	// validate input
	if (!postObj) {
		return next(new HttpException(417, `Expected to receive body data`, undefined, "text"));
	}

	// validate msgtype
	const msgtype = postObj["msgtype"]
	if (!['control', 'data'].includes(msgtype)) {
		// invalid message type
		return next(new HttpException(417, `Invalid msgtype <${msgtype}> received`, undefined, "text"));
	}

	// lookup services
	services.lookupService(["log", "event", "storage", "identity"]).then((svcs : BaseService[]) => {
		// get services
		const logSvc = svcs[0] as LogService;
		const eventSvc = svcs[1] as EventService;
		const storage = svcs[2] as StorageService;
		const identity = svcs[3] as IdentityService;

		// get data obj if there
		const dataObj = postObj.data || undefined;

		// validate msgtype
		if (!["control","data"].includes(msgtype)) return next(new HttpException(500, `Unknown msgtype supplied`, undefined, "text"));

		// ensure we know the device
		let deviceId : string;
		if (msgtype === 'control') {
			deviceId = dataObj.deviceId;
		} else {
			deviceId = postObj.deviceId;
		}

		// get impersonation user
		const user = identity.getServiceBackendIdentity("legacydatapost");
		logSvc.warn(`Getting service backend identity as device (<${deviceId}>) is using LEGACY data access`);

		storage.getDevice(user, deviceId).then(device => {
			// we found the device- acknowledge post to caller
			let j = JSON.stringify(postObj, undefined, 2);
			logSvc.debug(`Received: ${j}`)
			res.set('Content-Type', 'text/plain').send(`Thank you - you posted: ${j}\n`).end()

			// inspect message type
			if (msgtype === 'control') {
				// control message - get type
				let type = ControlMessageTypes.unknown;
				if (dataObj.hasOwnProperty("restart")) {
					type = ControlMessageTypes.restart;
				}  else if (dataObj.hasOwnProperty("watchdogReset")) {
					type = ControlMessageTypes.watchdogReset;
				}

				// create payload and publish to queue
				postControlEvent(eventSvc, logSvc, {
					"type": type,
					"id": device.id
				} as IngestedControlMessage);

			} else if (msgtype === 'data') {
				// post message that we heard from the device
				eventSvc.publishQueue(constants.QUEUES.DEVICE, {
					"id": device.id
				} as IngestedDeviceMessage).then(resp => {
					logSvc.debug(`Posted message (<${JSON.stringify(resp.data)}>) to queue <${resp.exchangeName}>`);
					const msg = resp.data as IngestedDeviceMessage;
	
					// see if there is sensor data
					if (!postObj.data || !Array.isArray(postObj.data) || !postObj.data.length) {
						// there is no data, it's not an array or no elements in it 
						// publish event to indicate that
						postControlEvent(eventSvc, logSvc, {
							"type": ControlMessageTypes.noSensorData,
							"id": deviceId
						} as IngestedControlMessage);
	
					} else {
						// send out a sensor reading message per reading
						postObj.data.filter((element : any) => element["sensorId"] && element["sensorValue"]).forEach((element : any) => {
							const payload : IngestedSensorMessage = {
								'value': element["sensorValue"],
								'id': element["sensorId"],
								"deviceId": msg.id
							}
							eventSvc.publishQueue(constants.QUEUES.SENSOR, payload);
						})
					}
				})
			}

		}).catch(err => {
			// unknown device
			logSvc.warn(`Unable to find device by ID <${deviceId}> in database - maybe unknown...`);
			next(new HttpException(500, `Unable to find device from payload or other error`, err));
		})

	}).catch((err:Error) => {
		return res.set('Content-Type', 'text/plain; charset=utf-8').status(500).send(`Unable to find event bus (${err.message})`).end()
	})
})

export default router;
