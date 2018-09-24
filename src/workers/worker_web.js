const path = require('path')
const constants = require('../constants.js')
const terminateListener = require('../terminate-listener.js')
const configureExpress = require('../configure-express.js')
const services = require('../configure-services.js')

// load environment variables for localhost
try {
	env(path.join(__dirname, '.env'));
} catch (e) {}

// add services
services.registerService(new (require('../services/event-service.js'))())
services.registerService(new (require('../services/storage-service.js'))())
services.registerService(new (require('../services/database-service.js'))())

// configure express
const app = configureExpress()

// configure pubnub listeners
require('../configure-pubnub-listeners.js')()

// start server
console.log(`Starting to listen for HTTP traffic on port ${process.env.PORT || 8080}`)
app.listen(process.env.PORT || 8080)

// setup termination listener
terminateListener(() => {
	console.log("Terminating services");
	services.terminate()
	console.log("Terminated services");
});
