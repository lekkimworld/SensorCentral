import * as express from 'express';
import { WatchdogNotification, Sensor, DeviceStatus, Device, SensorReading, RedisSensorMessage, SensorSample, HttpException } from '../types';
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

router.get('/house/:houseid', (req, res, next) => {
	if (!req.params.houseid) return next(new HttpException(417, "Expected house id"));

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

router.get("/house/:houseid/:deviceid", (req, res, next) => {
	if (!req.params.houseid) return next(new HttpException(417, "Expected house id"));
	if (!req.params.deviceid) return next(new HttpException(417, "Expected device id"));
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
			return next(new HttpException(417, "Device and house id mismatch"));
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

router.get("/house/:houseid/:deviceid/:sensorid", (req, res, next) => {
	if (!req.params.houseid) return next(new HttpException(417, "Expected house id"));
	if (!req.params.deviceid) return next(new HttpException(417, "Expected device id"));
	if (!req.params.sensorid) return next(new HttpException(417, "Expected sensor id"));
	const houseid = req.params.houseid;
	const deviceid = req.params.deviceid;
	const sensorid = req.params.sensorid;

	lookupService("storage").then((svc : StorageService) => {
		svc.getKnownSensorsWithRecentReadings
		svc.getSensorById(sensorid).then((sensor:Sensor) => {
			Promise.all([
				svc.getLastNSamplesForSensor(sensor.id),
				svc.getRecentReadingBySensorIds([sensor.id])
			]).then((data : any[]) => {
				const samples = data[0] as SensorSample[];
				const readings = data[1] as Map<string,RedisSensorMessage>;

				const reading = readings.get(sensor.id);
				res.render("configuration/sensorinfo", Object.assign({
					"houseId": houseid,
					"deviceId": deviceid,
					"sensorId": sensor.id,
					"sensorName": sensor.name,
					"sensor": sensor,
					"reading": reading ? utils.convert(reading, sensor) : undefined,
					"samples": samples
				}, utils.buildBaseHandlebarsContext(req)));
			})
		})
	})
})


export default router;
