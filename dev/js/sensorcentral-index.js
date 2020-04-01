const package = require('../../package.json');
const nameVersion = `${package.name}-${package.version}-${Date.now()}`;
const $ = require("jquery");
const log = require("roarr").default;

// register service worder
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(function() {
            console.log(`[ServiceWorker] Registered (${nameVersion})`); 
        });
}

// Ensure that `globalThis.ROARR` is configured.
globalThis.ROARR = globalThis.ROARR || {};
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

const navigationChange = () => {
    const hash = document.location.hash;
    const elemRoot = $("#main-body");
    log.debug(`navigationChange - hash <${hash}>`);
    
    if (!hash || "" === hash || "#root" === hash) {
        require("./sensorcentral-root")(document, elemRoot);
    } else if ("#about" === hash) {
        require("./sensorcentral-about")(document, elemRoot);
    } else if ("#dashboard" === hash) {
        require("./sensorcentral-dashboard")(document, elemRoot);
    } else if ("#houses" === hash) {
        require("./sensorcentral-houses")(document, elemRoot);
    } else {
        elemRoot.html(`<h1>Oh no!!</h1>
        <p>
            Something went wrong or you requested an unknown page.
        </p>`);
    }
};
window.addEventListener("DOMContentLoaded", navigationChange);
window.addEventListener("hashchange", navigationChange);

// ensure responsive menu closes after click
$('.navbar-nav>li>a').on('click', function(){
    $('.navbar-collapse').removeClass('show');
});
