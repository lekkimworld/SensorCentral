// load environment variables for localhost
try {
	require('dotenv').config()
} catch (e) {}

// require
const path = require('path')
const constants = require('../constants')
const terminateListener = require('../terminate-listener')
const configureExpress = require('../configure-express')
const services = require('../configure-services')
const { DatabaseService } = require("../services/database-service");
const { EventService } = require("../services/event-service");
const { LogService } = require("../services/log-service");
const { NotifyService } = require( "../services/notify-service");
const { PushoverService } = require( "../services/pushover-service");
const { RedisService } = require( "../services/redis-service");
const { StorageService } = require( "../services/storage-service");
const { WatchdogService } = require( "../services/watchdog-service");

// add services
services.registerService(new LogService());
services.registerService(new EventService());
services.registerService(new RedisService());
services.registerService(new StorageService());
services.registerService(new DatabaseService());
services.registerService(new PushoverService());
services.registerService(new NotifyService());
services.registerService(new WatchdogService());

// configure express
const app = configureExpress()

// configure queue listeners
require('../configure-listeners.js')()

// start server
console.log(`Starting to listen for HTTP traffic on port ${process.env.PORT || 8080}`)
app.listen(process.env.PORT || 8080)

// setup termination listener
terminateListener(() => {
	console.log("Terminating services");
	services.terminate()
	console.log("Terminated services");
});
