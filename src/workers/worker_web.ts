// load environment variables for localhost
import { config as dotenv_config } from "dotenv";
dotenv_config();

// require
import terminateListener from '../terminate-listener';
import configureExpress from '../configure-express';
//@ts-ignore
import services from '../configure-services';
import { DatabaseService } from "../services/database-service";
import { EventService } from "../services/event-service";
import { Logger } from "../logger";
import { NotifyService } from  "../services/notify-service";
import { RedisService } from  "../services/redis-service";
import { QueueListenerService } from  "../services/queuelistener-service";
import { StorageService } from '../services/storage-service';
import { WatchdogService } from  "../services/watchdog-service";
import { EmailService } from '../services/email-service';
import constants from '../constants';
import { IdentityService } from '../services/identity-service';
import { PowermeterService } from "../services/powermeter-service";
import { CronService } from "../services/cron-service";
import cronjobPowerdata  from "./cronjob_powerdata";

// number of workers we should create
const logger = new Logger("worker_web");
const WORKERS = process.env.WEB_CONCURRENCY || 1;
logger.info(`WEB_CONCURRENCY set to ${WORKERS}`);

// énsure required environment variables are set
const APP_DOMAIN = process.env.APP_DOMAIN;
if (!APP_DOMAIN) {
	logger.info("APP_DOMAIN environment variable not set - cannot start!");
	process.exit(1);
}
logger.info(`APP_DOMAIN set to ${APP_DOMAIN}`);
if (!process.env.SMARTME_KEY) {
	logger.info("SMARTME_KEY environment variable not set - cannot start!");
	process.exit(1);
}

// add services
services.registerService(new IdentityService());
services.registerService(new EventService());
services.registerService(new RedisService());
services.registerService(new QueueListenerService());
services.registerService(new StorageService());
services.registerService(new DatabaseService());
services.registerService(new NotifyService());
services.registerService(new WatchdogService());
services.registerService(new EmailService());
services.registerService(new PowermeterService());
services.registerService(new CronService());

// setup termination listener
terminateListener(() => {
	logger.info("Terminating services");
	services.terminate()
	logger.info("Terminated services");
});

// start app
const main = async () => {
	// configure express
	const app = await configureExpress();

	// add cron jobs
	logger.info("Start adding cron jobs");
	const cron = services.getService(CronService.NAME) as CronService;
	cron.add("load-powerdata-daily", "0 1 * * *", cronjobPowerdata);
	logger.info("Done adding cron jobs");

	// start server
	logger.info(`${constants.APP.NAME} -- Worker starting to listen for HTTP traffic on port ${process.env.PORT || 8080}`);
	app.listen(process.env.PORT || 8080);
}
main();
