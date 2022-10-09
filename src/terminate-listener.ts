import { Logger } from "./logger";

const logger = new Logger("terminate-listener");

export type CallbackFunction = () => void;
export default (callback: CallbackFunction) => {
    // attach user callback to the process event emitter
    // if no callback, it will still exit gracefully on Ctrl-C
    callback = callback || (() => {});

    //@ts-ignore
    process.on("cleanup", () => {
        callback();
    });

    // do app specific cleaning before exiting
    process.on("exit", function () {
        //@ts-ignore
        process.emit("cleanup");
    });

    // catch SIGTERM event (Heroku) and exit normally
    process.on("SIGTERM", function () {
        logger.info("SIGTERM (Heroku)...");
        process.exit(0);
    });

    // catch ctrl+c event and exit normally
    process.on("SIGINT", function () {
        logger.info("Ctrl-C...");
        process.exit(0);
    });

    //catch uncaught exceptions, trace, then exit normally
    process.on("uncaughtException", function (e) {
        logger.error(`Uncaught Exception ${e.stack}`, e);
        process.exit(99);
    });
};
