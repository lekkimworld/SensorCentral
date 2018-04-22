const path = require('path')
const terminateListener = require('../terminate-listener.js')
const configureExpress = require('../configure-express.js')
const srvc = require('../configure-services.js')

// load environment variables for localhost
try {
  env(path.join(__dirname, '.env'));
} catch (e) {}

// configure express and start server
const app = configureExpress()
console.log(`Starting to listen for HTTP traffic on port ${process.env.PORT || 8080}`)
app.listen(process.env.PORT || 8080)

// setup termination listener
terminateListener(() => {
  console.log("Terminating services");
  srvc.terminate()
  console.log("Terminated services");
});