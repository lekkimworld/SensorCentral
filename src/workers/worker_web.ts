// load environment variables for localhost
import { config as dotenv_config } from "dotenv";
dotenv_config();

// require
import "reflect-metadata";
import terminateListener from '../terminate-listener';
//@ts-ignore
import services from '../configure-services';
import { DatabaseService } from "../services/database-service";
import { PubsubService } from "../services/pubsub-service";
import { Logger } from "../logger";
import { NotifyService } from  "../services/notify-service";
import { RedisService } from  "../services/redis-service";
import { QueueListenerService } from  "../services/queuelistener-service";
import { StorageService } from '../services/storage-service';
import { DataQueryService } from "../services/dataquery/dataquery-service";
import { EmailService } from '../services/email-service';
import constants from '../constants';
import { IdentityService } from '../services/identity-service';
import { PowermeterService } from "../services/powermeter-service";
import { CronService } from "../services/cron-service";
import cronjobPowerdata  from "./cronjob_powerdata";
import { AlertService } from "../services/alert/alert-service";
import { EventService } from "../services/event-service";
import { PowerpriceService } from "../services/powerprice-service";
import { QueueService } from "../services/queue-service";
import { ExpressService } from "../services/express-service";

// number of workers we should create
const logger = new Logger("worker_web");
const WORKERS = process.env.WEB_CONCURRENCY || 1;
logger.info(`WEB_CONCURRENCY set to ${WORKERS}`);

// ensure required environment variables are set
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
services.registerService(new ExpressService());
services.registerService(new RedisService());
services.registerService(new DatabaseService());
services.registerService(new IdentityService());
services.registerService(new PubsubService());
services.registerService(new QueueService());
services.registerService(new QueueListenerService());
services.registerService(new StorageService());
services.registerService(new NotifyService());
services.registerService(new EmailService());
services.registerService(new PowermeterService());
services.registerService(new CronService());
services.registerService(new DataQueryService());
services.registerService(new AlertService());
services.registerService(new EventService());
services.registerService(new PowerpriceService());

// setup termination listener
terminateListener(() => {
	logger.info("Terminating services");
	services.terminate()
	logger.info("Terminated services");
});

// start app
const main = async () => {
	// show node_env
	logger.info(`Starting app - NODE_ENV <${process.env.NODE_ENV}> APP_GITCOMMIT <${constants.APP.GITCOMMIT}> APP_VERSION <${constants.APP.VERSION}> APP_TITLE <${constants.APP.TITLE}>`);
	
	// configure express
	const app = await (await services.lookupService(ExpressService.NAME) as ExpressService).configureExpress();

	// add cron jobs
	logger.info("Start adding cron jobs");
	const cron = services.getService(CronService.NAME) as CronService;
	cron.add("load-powerdata-daily", "0 1 * * *", cronjobPowerdata, true);
	logger.info("Done adding cron jobs");

	// start server
	logger.info(`${constants.APP.NAME} -- Worker starting to listen for HTTP traffic on port ${process.env.PORT || 8080}`);
	app.listen(process.env.PORT || 8080);
}
main();
