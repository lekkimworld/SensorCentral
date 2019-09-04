import { Application } from "express";
import postSensorDataRouter from './routes/post-sensor-data';
import prometheusScrapeRouter from "./routes/prometheus-scape-endpoint";
import sensorsRouter from "./routes/get-sensors";
import devicesRouter from "./routes/get-devices";
import apiV1Routes from "./routes/api/v1/api_routes";

export function routes(app : Application) {
	app.use('/', postSensorDataRouter);
	app.use('/devices', devicesRouter);
	app.use('/sensors', sensorsRouter);
	app.use('/', require('./routes/get-about.js'));
	app.use('/', require('./routes/get-root.js'));
	app.use('/', prometheusScrapeRouter);
	app.use('/api/v1', apiV1Routes);
}
