import { Application } from "express";
import postSensorDataRouter from './routes/post-sensor-data';
import prometheusScrapeRouter from "./routes/prometheus-scape-endpoint";
import apiV1Routes from "./routes/api/v1/api_routes";
import smartmeRoutes from "./routes/smartme";
import attachGetRoot from "./routes/get-root";
import attachGraphQL from "./configure-express-graphql";
import oidcRouter from "./routes/oidc";

export default async (app : Application) => {
	// add anonymous routes
	app.use("/", attachGetRoot);
	app.use('/', postSensorDataRouter);
	app.use('/scrapedata', prometheusScrapeRouter);

	// add login routes (anonymous)
	app.use("/openid", oidcRouter);

	// add smart.me routes (basic auth)
	app.use("/smartme", smartmeRoutes);
	
	// add api routes
	app.use('/api/v1', apiV1Routes);

	// attach graphql
	await attachGraphQL(app);
}
