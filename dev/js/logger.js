const log = require("roarr").default;

// Ensure that `globalThis.ROARR` is configured.
globalThis.ROARR = globalThis.ROARR || {};
if (!globalThis.ROARR.write) {
    globalThis.ROARR.write = (message) => {
        const payload = JSON.parse(message);
        const idx = document.location.search ? document.location.search.indexOf("?loglevel=") : -1;
        let logLevel = 30;
        if (idx >= 0) {
            logLevel = document.location.search.substr(idx+10, 2) - 0;
            console.log(`Log level <${logLevel}>`);
        }
        if (payload.context.logLevel > logLevel) {
            console.log(payload.message, payload);
        }
    };
}

module.exports = log;
