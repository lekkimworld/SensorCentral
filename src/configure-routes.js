
module.exports = (app) => {
	app.use('/', require('./routes/post-sensor-data.js'))
	app.use('/', require('./routes/get-dashboard.js'))
	app.use('/', require('./routes/get-about.js'))
	app.use('/', require('./routes/get-root.js'))
	app.use('/', require('./routes/prometheus-scape-endpoint.js'))
}