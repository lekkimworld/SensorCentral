// load environment variables for localhost
import { config as dotenv_config } from "dotenv";
dotenv_config();

// require
import "reflect-metadata";
import terminateListener from '../terminate-listener';
import services from '../configure-services';
import { DatabaseService } from "../services/database-service";
import { PubsubService } from "../services/pubsub-service";
import { Logger } from "../logger";
import { RedisService } from  "../services/redis-service";
import { QueueListenerService } from  "../services/queuelistener-service";
import { StorageService } from '../services/storage-service';
import { DataQueryService } from "../services/dataquery/dataquery-service";
import { EmailService } from '../services/email-service';
import constants from '../constants';
import { IdentityService } from '../services/identity-service';
import { PowermeterService } from "../services/powermeter-service";
import { CronService } from "../services/cron-service";
import { CronJobSchedulerService } from "../services/cronjob-scheduler-service";
import { CalloutCronJobHandler } from "../services/callout-cronjob-handler";
import cronjobPowerdata  from "./cronjob_powerdata";
import { WatchdogService } from "../services/watchdog/watchdog-service";
import { EventService } from "../services/event-service";
import { PowerpriceService } from "../services/powerprice-service";
import { QueueService } from "../services/queue-service";
import CalloutService from "../services/callout-service";
import { ExpressService } from "../services/express-service";
import { recordStatusSnapshot } from "../routes/admin";

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
// add services
services.registerService(new ExpressService());
services.registerService(new RedisService());
services.registerService(new DatabaseService());
services.registerService(new IdentityService());
services.registerService(new PubsubService());
services.registerService(new QueueService());
services.registerService(new QueueListenerService());
services.registerService(new StorageService());
services.registerService(new EmailService());
services.registerService(new CalloutService());
services.registerService(new PowermeterService());
services.registerService(new CronService());
services.registerService(new CalloutCronJobHandler());
services.registerService(new CronJobSchedulerService());
services.registerService(new DataQueryService());
services.registerService(new WatchdogService());
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

	// healthchecks.io ping (every minute) - checks DB/Redis directly without HTTP self-fetch
	const healthchecksUrl = process.env.HEALTHCHECKS_URL;
	if (healthchecksUrl) {
		const hcLogger = new Logger("healthchecks");
		cron.add("healthchecks-ping", "* * * * *", async () => {
			const fetchOpts = { signal: AbortSignal.timeout(10000) };
			try {
				const redis = services.getService(RedisService.NAME) as RedisService;
				await redis.getClient().ping();
				const db = services.getService(DatabaseService.NAME) as DatabaseService;
				await db.query("SELECT 1");

				hcLogger.debug("Local health check OK - pinging healthchecks.io");
				const r = await fetch(healthchecksUrl, fetchOpts);
				await r.text();
			} catch (err) {
				hcLogger.warn(`Health check error: ${err.message}`);
				try {
					const r = await fetch(`${healthchecksUrl}/fail`, fetchOpts);
					await r.text();
				} catch (innerErr) {
					hcLogger.error(`Failed to report failure to healthchecks.io: ${innerErr.message}`);
				}
			}
		});
		logger.info("Registered healthchecks.io ping cron job");
	} else {
		logger.info("HEALTHCHECKS_URL not set - skipping healthchecks.io integration");
	}

	cron.add("status-snapshot", "* * * * *", async () => {
		try {
			await recordStatusSnapshot();
		} catch (err) {
			logger.warn(`Status snapshot error: ${err.message}`);
		}
	});

	logger.info("Done adding cron jobs");

	// start server
	logger.info(`${constants.APP.NAME} -- Worker starting to listen for HTTP traffic on port ${process.env.PORT || 8080}`);
	app.listen(process.env.PORT || 8080);
}
main();
