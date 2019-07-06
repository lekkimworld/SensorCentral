#SensorCentral#


post data
if control message
    1 msg to controlMessage topic
if data message
    1 msg per device to rawDeviceReading queue
    1 msg per sensor in post data to rawSensorReading queue


https://github.com/milesburton/Arduino-Temperature-Control-Library
https://github.com/bportaluri/WiFiEsp
