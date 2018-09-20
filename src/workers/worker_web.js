const path = require('path')
const constants = require('../constants.js')
const terminateListener = require('../terminate-listener.js')
const configureExpress = require('../configure-express.js')
const srvc = require('../configure-services.js')

// load environment variables for localhost
try {
  env(path.join(__dirname, '.env'));
} catch (e) {}

// add services
require('./services/event-service.js')
require('./services/storage-service.js')
require('./services/database-service.js')

// configure express
const app = configureExpress()

// configure pubnub listeners
require('../configure-pubnub-listeners.js')()

// start server
console.log(`Starting to listen for HTTP traffic on port ${process.env.PORT || 8080} (PRODUCTION: ${constants.IS.PRODUCTION})`)
app.listen(process.env.PORT || 8080)

// setup termination listener
terminateListener(() => {
  console.log("Terminating services");
  srvc.terminate()
  console.log("Terminated services");
});
