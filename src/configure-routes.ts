import { Application } from "express";
import postSensorDataRouter from './routes/post-sensor-data';
import prometheusScrapeRouter from "./routes/prometheus-scape-endpoint";
import dashboardRouter from "./routes/get-dashboard"

export function routes(app : Application) {
	app.use('/', postSensorDataRouter);
	app.use('/dashboard', dashboardRouter);
	app.use('/', require('./routes/get-about.js'));
	app.use('/', require('./routes/get-root.js'));
	app.use('/', prometheusScrapeRouter);
	app.use('/api/v1', require('./routes/api/v1/api_routes.js'));
}
