import * as express from 'express';
const services = require('../configure-services');
import {EventService} from "../services/event-service";
import {constants} from "../constants";
import { LogService } from '../services/log-service';
import { StorageService } from '../services/storage-service';
import { BaseService, IngestedControlMessage, Device, IngestedDeviceMessage, IngestedSensorMessage, ControlMessageTypes } from '../types';

// max temp to register
const MIN_REGISTER_TEMP = process.env.MIN_REGISTER_TEMP || constants.SENSOR_VALUES.MIN_REGISTER_TEMP

const router = express.Router();
router.post('/*', (req, res) => {
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
		res.set({
			'Content-Type': 'text/plain'
		})
		return res.status(417).send(`Expected to receive body data`).end()
	}

	// validate msgtype
	const msgtype = postObj["msgtype"]
	if (!['control', 'data'].includes(msgtype)) {
		// invalid message type
		return res.set({
			'Content-Type': 'text/plain'
		}).status(417).send(`Invalid msgtype <${msgtype}> received`).end()
	}

	// lookup services
	services.lookupService(['log', 'event', 'storage']).then((svcs : BaseService[]) => {
		// get services
		const logSvc = svcs[0] as LogService;
		const eventSvc = svcs[1] as EventService;
		const storageSvc = svcs[2] as StorageService;

		// acknowledge post to caller
		let j = JSON.stringify(postObj, undefined, 2)
		logSvc.debug(`Received: ${j}`)
		res.set('Content-Type', 'text/plain').send(`Thank you - you posted: ${j}\n`).end()

		// get data obj if there
		const dataObj = postObj.data || undefined;

		// inspect message type
		if (msgtype === 'control') {
			// control message - get type
			let type = ControlMessageTypes.unknown;
			if (dataObj.hasOwnProperty("restart")) {
				type = ControlMessageTypes.restart;
			}  else if (dataObj.hasOwnProperty("watchdogReset")) {
				type = ControlMessageTypes.watchdogReset;
			}

			// get device id
			const deviceId : string = dataObj.deviceId ? dataObj.deviceId : undefined;
			if (!deviceId) {
				logSvc.warn(`Ignoring control message (type: ${type}) as there is no deviceId attribute (${JSON.stringify(dataObj)})`)
				return;
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

		} else if (msgtype === 'data' && dataObj.data.length) {
			// send a message to indicate we heard from the device
			(function() : Promise<string> {
				if (dataObj.deviceId) {
					// found device id in payload
					return Promise.resolve(dataObj.deviceId);
				} else {
					// there is no device id in the payload - get unique device id('s) from sensor ids
					let sensorIds : Set<string> = dataObj.data.filter((element : object) => element["sensorId"] && element["sensorValue"]).reduce((prev, element) => {
						prev.add(element.sensorId) as string;
						return prev
					}, new Set<string>())

					return storageSvc.getDeviceIdForSensorIds(...Array.from(sensorIds));
				}
			})().then((deviceId : string) => {
				// found device - publish a device event
				const payload : IngestedDeviceMessage = {
					"id": deviceId
				}
				return eventSvc.publishQueue(constants.QUEUES.DEVICE, payload);

			}).then(resp => {
				logSvc.debug(`Posted message (<${JSON.stringify(resp.data)}>) to queue <${resp.exchangeName}>`);
				const msg = resp.data as IngestedDeviceMessage;

				// send out a sensor reading message per reading
				dataObj.data.filter((element : object) => element["sensorId"] && element["sensorValue"]).forEach((element : object) => {
					const payload : IngestedSensorMessage = {
						'value': element["sensorValue"],
						'id': element["sensorId"],
						"deviceId": msg.id
					}
					eventSvc.publishQueue(constants.QUEUES.SENSOR, payload).then(resp => {

					}).catch(err => {
						
					})
				})
				

			}).catch(err => {
				// logSvc.error(`Could NOT post message (<${JSON.stringify(err.data)}>) to queue <${err.exchangeName}>`, err)
			})
		}
	}).catch((err:Error) => {
		return res.set('Content-Type', 'text/plain; charset=utf-8').status(500).send('Unable to find event bus').end()
	})
})

export default router;
