export type CallbackFunction = () => void;
export default (callback : CallbackFunction) => {
    // attach user callback to the process event emitter
    // if no callback, it will still exit gracefully on Ctrl-C
    callback = callback || (() => {});
    
    //@ts-ignore
    process.on('cleanup', () => {
        callback();
    });    

    // do app specific cleaning before exiting
    process.on('exit', function () {
        //@ts-ignore
        process.emit('cleanup');
    });

    // catch SIGTERM event (Heroku) and exit normally
    process.on('SIGTERM', function () {
        console.log('SIGTERM (Heroku)...');
        process.exit(3);
    });

    // catch ctrl+c event and exit normally
    process.on('SIGINT', function () {
        console.log('Ctrl-C...');
        process.exit(2);
    });

    //catch uncaught exceptions, trace, then exit normally
    process.on('uncaughtException', function(e) {
        console.log('Uncaught Exception...');
        console.log(e.stack);
        process.exit(99);
    });
};
