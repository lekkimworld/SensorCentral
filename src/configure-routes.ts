import { Application } from "express";
import postSensorDataRouter from './routes/post-sensor-data';
import prometheusScrapeRouter from "./routes/prometheus-scape-endpoint";
import apiV1Routes from "./routes/api/v1/api_routes";

export function routes(app : Application) {
	app.use('/', require('./routes/get-root'));
	app.use('/scrapedata', prometheusScrapeRouter);
	app.use('/api/v1', apiV1Routes);
	app.use('/', postSensorDataRouter);
}
