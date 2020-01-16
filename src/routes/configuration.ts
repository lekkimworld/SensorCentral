import * as express from 'express';
import { WatchdogNotification, Sensor, DeviceStatus, Device, SensorReading } from '../types';
import { StorageService } from '../services/storage-service';
import * as utils from "../utils";
const {lookupService} = require('../configure-services');

const router = express.Router();

router.get('/', (req, res) => {
	lookupService("storage").then((svc : StorageService) => {
		svc.getHouses().then(houses => {
			const ctx = Object.assign({
				"title": "Houses",
				"houses": houses
			}, utils.buildBaseHandlebarsContext(req));
			res.render("configuration/houses", ctx);
		})
	})
})

router.get('/house/:houseid', (req, res) => {
	if (!req.params.houseid) return res.status(417).send("Expected house id");

	lookupService("storage").then((svc : StorageService) => {
		return Promise.all([svc.getDevices(req.params.houseid), svc.getKnownDevicesStatus()]).then(data => {
			const devices = data[0] as Device[];
			const statuses = data[1] as DeviceStatus[];
			const ctx = Object.assign({
				"title": "Devices",
				"parentId": req.params.houseid,
				"devices": devices.map(device => {
					// find status
					const status = statuses.filter(s => s.id === device.id);
					return {
						"id": device.id,
						"name": device.name,
						"notify": device.notify === WatchdogNotification.yes ? "on" : device.notify === WatchdogNotification.no ? "off": "mute",
						"mutedUntil": device.mutedUntil && device.notify === WatchdogNotification.muted ? utils.formatDate(device.mutedUntil) : undefined,
						//@ts-ignore
						"lastping": status && status.length ? status[0].ageMinutes : undefined
					}
				})}, utils.buildBaseHandlebarsContext(req)
			)
			res.render("configuration/devices", ctx);
		})
	})
})

router.get("/house/:houseid/:deviceid", (req, res) => {
	if (!req.params.houseid) return res.status(417).send("Expected house id");
	if (!req.params.deviceid) return res.status(417).send("Expected device id");
	const deviceid = req.params.deviceid;

	lookupService("storage").then((svc : StorageService) => {
		return Promise.all([
			svc.getSensors(req.params.deviceid),
			svc.getUnknownSensorsWithRecentReadings()
		]);

	}).then((data : any) => {
		const sensors = data[0] as Sensor[];
		const unknown = data[1] as SensorReading[];
		if (sensors.filter(s => s.device?.house.id === req.params.houseid).length != sensors.length) {
			// at least one device is from another house than requested - cannot be
			return res.status(417).send("Device and house id mismatch");
		}

		res.render("configuration/sensors", Object.assign({
			"title": "Sensors",
			"houseId": req.params.houseid,
			"deviceId": req.params.deviceid,
			"sensors": sensors,
			"unregisteredSensors": unknown.filter(u => u.deviceId && u.deviceId === deviceid)
		}, utils.buildBaseHandlebarsContext(req)));
	})
})


export default router;
