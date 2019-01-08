const express = require('express')
const router = express.Router()
const {lookupService} = require('../configure-services.js')

router.get('/scrapedata', (req, res) => {
    lookupService('storage').then(svc => {
        // set content-type and send response
        res.set({
            'Content-Type': 'text/plain'
        })
        const buffer = []

        if (svc.getSensorIds() && Array.isArray(svc.getSensorIds())) {
            // add sensors
            svc.getSensorIds().forEach(sensorId => {
                let obj = svc.getSensorById(sensorId)
                if (!obj.sensorValue || obj.sensorValue === Number.MIN_VALUE) return buffer
                let fixedName = obj.sensorLabel ? obj.sensorLabel : `nolabel${obj.sensorId}`
                let deviceId = obj.device && obj.device.deviceId ? obj.device.deviceId : 'unknown'
                let deviceName = obj.device && obj.device.deviceName ? obj.device.deviceName : 'unknown'
                buffer.push(`sensor_${fixedName}\{sensorId="${obj.sensorId}",deviceId="${deviceId}",deviceName="${deviceName}"\} ${obj.sensorValue}`)
            })
        }

        if (svc.getDeviceIds && svc.getDeviceIds() && Array.isArray(svc.getDeviceIds())) {
            // add devices restarts
            svc.getDeviceIds().forEach(deviceId => {
                let obj = svc.getDeviceById(deviceId)
                buffer.push(`device_restart\{deviceId="${obj.deviceId}",deviceName=\"${obj.deviceName}\"\} ${obj.restarts ? obj.restarts : 0}`)
            })

            // add devices watchdog resets
            svc.getDeviceIds().forEach(deviceId => {
                let obj = svc.getDeviceById(deviceId)
                buffer.push(`device_watchdog_reset\{deviceId="${obj.deviceId}",deviceName=\"${obj.deviceName}\"\} ${obj.watchdogResets ? obj.watchdogResets : 0}`)
            })
        }

        // send to client
        res.status(200).send(buffer.join('\n')).end()

    }).catch(err => {
        res.set({
            'Content-Type': 'text/plain'
        })
        res.status(500).send('Required service not available').end()
    })
})

module.exports = router
