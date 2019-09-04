import * as express from 'express';
import {constants} from "../constants";
import * as moment from 'moment-timezone';
const {lookupService} = require('../configure-services');
import { StorageService } from '../services/storage-service';
import { BaseService } from "../types";
import * as utils from "../utils";

const router = express.Router();

router.get('/known', (req, res) => {
    
    lookupService("storage").then((svc : BaseService) => {
		const storageService = svc as StorageService;

		storageService.getKnownDevicesStatus().then(deviceStatuses => {
			// build result object for template
			let context = {
				'updated': utils.formatDate(),
				"title": "Known Devices",
				'data': deviceStatuses
			}
			res.render('devices', context)
		})
    }).catch((err : Error) => {
		console.log(err)
    	res.status(500).send('Required storage-service not available').end()
	})
})

router.get('/unknown', (req, res) => {
    
    lookupService("storage").then((svc : BaseService) => {
		const storageService = svc as StorageService;

		storageService.getUnknownDevicesStatus().then(sensorReadings => {
			// build result object for templte
			let context = {
				'updated': utils.formatDate(),
				"title": "Unknown Devices",
				'data': sensorReadings
			}
			res.render('devices', context)
		})
    }).catch((err : Error) => {
		console.log(err)
    	res.status(500).send('Required storage-service not available').end()
	})
})

export default router;
