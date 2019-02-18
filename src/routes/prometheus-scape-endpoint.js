const express = require('express')
const router = express.Router()
const {lookupService} = require('../configure-services.js')

router.get('/scrapedata', (req, res) => {
    res.set({
        'Content-Type': 'text/plain'
    })

    lookupService(['storage', 'log']).then(svcs => {
        // define common buffer
        const storage = svcs[0];
        const buffer = [];

        // get sensors from storage service
        storage.getSensors().then(sensors => {
            // traverse and process each sensor in turn
            for (let sensorId in sensors) {
                const sensor = sensors[sensorId];
                if (!sensor.sensorValue || sensor.sensorValue === Number.MIN_VALUE) continue;
                let fixedName = sensor.sensorLabel ? sensor.sensorLabel : `nolabel${sensor.sensorId}`;
                let deviceId = sensor.device && sensor.device.deviceId ? sensor.device.deviceId : 'unknown';
                let deviceName = sensor.device && sensor.device.deviceName ? sensor.device.deviceName : 'unknown';
                buffer.push(`sensor_${fixedName}\{sensorId="${sensor.sensorId}",deviceId="${deviceId}",deviceName="${deviceName}"\} ${sensor.sensorValue}`);
            }
            
            // get devices
            return storage.getDevices();

        }).then(devices => {
            // traverse and process each device restart or watchdog event in turn
            for (let deviceId in devices) {
                const device = devices[deviceId];
                buffer.push(`device_restart\{deviceId="${device.deviceId}",deviceName=\"${device.deviceName}\"\} ${device.restarts ? device.restarts : 0}`)
            }
            for (let deviceId in devices) {
                const device = devices[deviceId];
                buffer.push(`device_watchdog_reset\{deviceId="${device.deviceId}",deviceName=\"${device.deviceName}\"\} ${device.watchdogResets ? device.watchdogResets : 0}`)
            }

            return Promise.resolve();

        }).then(() => {
            // send response
            res.status(200).send(buffer.join('\n')).end()

        }).catch(err => {
            // send error response
            const log = svcs[1];
            log.error('Unable to get Prometheus scrape target data', err);
            res.status(500).end();
        })

    }).catch(err => {
        res.status(500).send('Required storage-service not available').end()
    })
})

module.exports = router
