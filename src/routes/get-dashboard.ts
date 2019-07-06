import * as express from 'express';
import {constants} from "../constants";
import * as moment from 'moment-timezone';
const {lookupService} = require('../configure-services');
import { StorageService } from '../services/storage-service';
import { BaseService } from "../types";
import * as utils from "../utils";

const router = express.Router();

router.get('/unknown', (req, res) => {
    
    lookupService("storage").then((svc : BaseService) => {
		const storageService = svc as StorageService;

		storageService.getUnknownSensorsWithRecentReadings().then(sensorReadings => {
			// build result object for templte
			let context = {
				'updated': utils.formatDate(),
				"title": "Unknown Sensor Readings",
				'data': sensorReadings
			}
			res.render('dashboard', context)
		})
    }).catch((err : Error) => {
		console.log(err)
    	res.status(500).send('Required storage-service not available').end()
	})
})

router.get('/known', (req, res) => {
    
    lookupService("storage").then((svc : BaseService) => {
		const storageService = svc as StorageService;

		storageService.getKnownSensorsWithRecentReadings().then(sensorReadings => {
			// build result object for templte
			let context = {
				'updated': utils.formatDate(),
				"title": "Known Sensor Readings",
				'data': sensorReadings
			}
			res.render('dashboard', context)
		})
    }).catch((err : Error) => {
		console.log(err)
    	res.status(500).send('Required storage-service not available').end()
	})
})

export default router;
