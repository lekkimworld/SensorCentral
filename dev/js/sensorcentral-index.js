const package = require('../../package.json');
const nameVersion = `${package.name}-${package.version}-${Date.now()}`;
const $ = require("jquery");
const log = require("./logger.js");
const uiutils = require("./ui-utils.js");
const storage = require("./storage-utils");

// register service worder
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(function() {
            console.log(`[ServiceWorker] Registered (${nameVersion})`); 
        });
}

const navigationChange = () => {
    // set / clear username dropdown and menus
    uiutils.fillMenus();
    
    // get hash
    const hash = document.location.hash;
    const path = document.location.pathname;
    if ("/openid/loggedin" === path) {
        // user has been logged it
        return fetch("/api/v1/login/jwt").then(resp => resp.json()).then(body => {
            storage.setUser(body);
            document.location.href = "/#root";
        })
    }
    const elemRoot = $("#main-body");
    const user = storage.getUser();
    log.debug(`navigationChange - hash <${hash}>`);
    
    if ("#login" === hash) {
        fetch("/api/v1/login").then(resp => resp.json()).then(body => {
            console.log(body);
            if (body.hasOwnProperty("error")) {
                log.warn(`Received error back from login api <${body.message}>`);
                require("./sensorcentral-offline")(document, elemRoot);
            } else {
                log.debug(`Received URL for login back from API - redirecting to it...`);
                document.location.href = body.url;
            }
        }).catch(err => {
            console.log(err)
        })
    } else if (!user || !hash || "" === hash || "#root" === hash) {
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
