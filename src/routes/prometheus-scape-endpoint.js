const express = require('express')
const router = express.Router()
const {lookupService} = require('../configure-services.js')

router.get('/scrapedata', (req, res) => {
    lookupService('storage').then(svc => {
        // get storage instance
        const storage = svc.getInstance()

        // set content-type and send response
        res.set({
            'Content-Type': 'text/plain'
        })
        res.status(200).send(Object.values(storage).reduce((buffer, obj) => {
            if (!obj.sensorValue || obj.sensorValue === Number.MIN_VALUE) return buffer
            let fixedName = obj.sensorLabel ? obj.sensorLabel : `nolabel${obj.sensorId}`
            let deviceId = obj.deviceId ? obj.deviceId : 'unknown'
            let deviceName = obj.deviceName ? obj.deviceName : 'unknown'
            buffer += `sensor_${fixedName}\{sensorId="${obj.sensorId}",deviceId="${deviceId}",deviceName="${deviceName}"\} ${obj.sensorValue}\n`
            return buffer
        }, '')).end()
    }).catch(err => {
        res.set({
            'Content-Type': 'text/plain'
        })
        res.status(500).send('Required service not available').end()
    })
})

module.exports = router
