// load environment variables for localhost
require('dotenv').config()

// require
import terminateListener from '../terminate-listener';
import configureExpress from '../configure-express';
//@ts-ignore
import services from '../configure-services';
import { DatabaseService } from "../services/database-service";
import { EventService } from "../services/event-service";
import { LogService } from "../services/log-service";
import { NotifyService } from  "../services/notify-service";
import { RedisService } from  "../services/redis-service";
import { StorageService } from  "../services/storage-service";
import { WatchdogService } from  "../services/watchdog-service";
import { EmailService } from '../services/email-service';
import constants from '../constants';

// number of workers we should create
const WORKERS = process.env.WEB_CONCURRENCY || 1;
console.log(`WEB_CONCURRENCY set to ${WORKERS}`);

// énsure required environment variables are set
const APP_DOMAIN = process.env.APP_DOMAIN as string;
if (!APP_DOMAIN) {
	console.log("APP_DOMAIN environment variable not set - cannot start!");
	process.exit(1);
}
console.log(`APP_DOMAIN set to ${APP_DOMAIN}`);
if (!process.env.SMARTME_KEY) {
	console.log("SMARTME_KEY environment variable not set - cannot start!");
	process.exit(1);
}

// add services
services.registerService(new LogService());
services.registerService(new EventService());
services.registerService(new RedisService());
services.registerService(new StorageService());
services.registerService(new DatabaseService());
services.registerService(new NotifyService());
services.registerService(new WatchdogService());
services.registerService(new EmailService());

// setup termination listener
terminateListener(() => {
	console.log("Terminating services");
	services.terminate()
	console.log("Terminated services");
});

// start app
const main = async () => {
	// configure express
	const app = await configureExpress();

	// start server
	console.log(`${constants.APP.NAME} -- Worker starting to listen for HTTP traffic on port ${process.env.PORT || 8080}`);
	app.listen(process.env.PORT || 8080);
}
main();
