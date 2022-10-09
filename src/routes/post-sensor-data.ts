import * as express from 'express';
const services = require('../configure-services');
import {EventService} from "../services/event-service";
import constants from "../constants";
import { Logger } from '../logger';
import { BaseService, IngestedControlMessage, IngestedDeviceMessage, IngestedSensorMessage, ControlMessageTypes, HttpException } from '../types';
import { StorageService } from 'src/services/storage-service';
import { IdentityService } from 'src/services/identity-service';

const logger = new Logger("post-sensor-data");
const router = express.Router();

const postControlEvent = (eventSvc : EventService, payload : IngestedControlMessage) => {
	eventSvc.publishQueue(constants.QUEUES.CONTROL, payload).then(resp => {
		logger.debug(`Posted message (<${JSON.stringify(resp.data)}>) to exchange <${resp.exchangeName}> and key <${resp.routingKey}>`)
	}).catch(err => {
		logger.error(`Could NOT post message (<${JSON.stringify(err.data)}>) to exchange <${err.exchangeName}> and key <${err.routingKey}>`, err)
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
	services.lookupService(["event", "storage", "identity"]).then((svcs : BaseService[]) => {
		// get services
		const eventSvc = svcs[0] as EventService;
		const storage = svcs[1] as StorageService;
		const identity = svcs[2] as IdentityService;

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
		logger.warn(`Getting service backend identity as device (<${deviceId}>) is using LEGACY data access`);

		storage.getDevice(user, deviceId).then(device => {
			// we found the device- acknowledge post to caller
			let j = JSON.stringify(postObj, undefined, 2);
			logger.debug(`Received: ${j}`)
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
				postControlEvent(eventSvc, {
					"type": type,
					"id": device.id
				} as IngestedControlMessage);

			} else if (msgtype === 'data') {
				// post message that we heard from the device
				eventSvc.publishQueue(constants.QUEUES.DEVICE, {
					"id": device.id
				} as IngestedDeviceMessage).then(resp => {
					logger.debug(`Posted message (<${JSON.stringify(resp.data)}>) to queue <${resp.exchangeName}>`);
					const msg = resp.data as IngestedDeviceMessage;
	
					// see if there is sensor data
					if (!postObj.data || !Array.isArray(postObj.data) || !postObj.data.length) {
						// there is no data, it's not an array or no elements in it 
						// publish event to indicate that
						postControlEvent(eventSvc, {
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
			logger.warn(`Unable to find device by ID <${deviceId}> in database - maybe unknown...`);
			next(new HttpException(500, `Unable to find device from payload or other error`, err));
		})

	}).catch((err:Error) => {
		return res.set('Content-Type', 'text/plain; charset=utf-8').status(500).send(`Unable to find event bus (${err.message})`).end()
	})
})

export default router;
