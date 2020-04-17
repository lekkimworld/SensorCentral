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
    } else if (!hash || "" === hash || "#root" === hash) {
        require("./sensorcentral-root")(document, elemRoot);
    } else if ("#loggedout" === hash) {
        require("./sensorcentral-loggedout")(document, elemRoot);
    } else if ("#about" === hash) {
        require("./sensorcentral-about")(document, elemRoot);
    } else if (!user) {
        require("./sensorcentral-root")(document, elemRoot);
    } else if (hash.indexOf("#configuration") === 0) {
        const parts = hash.split("/");
        if (parts.length === 2 && parts[1] === "houses") {
            // list houses
            log.debug(`Rendering sensorcentral-houses with parts <${parts.join()}>`);
            require("./sensorcentral-houses")(document, elemRoot);
        } else if (parts.length === 3 && parts[1] === "house") {
            // list devices for house
            log.debug(`Rendering sensorcentral-devices with parts <${parts.join()}>`);
            require("./sensorcentral-devices")(document, elemRoot, {"houseId": parts[2]});
        } else if (parts.length === 5 && parts[1] === "house" && parts[3] === "device") {
            // list sensors for device
            log.debug(`Rendering sensorcentral-sensors with parts <${parts.join()}>`);
            require("./sensorcentral-sensors")(document, elemRoot, {"houseId": parts[2], "deviceId": parts[4]});
        } else if (parts.length === 7 && parts[1] === "house" && parts[3] === "device" && parts[5] === "sensor") {
            // sensor details
            log.debug(`Rendering sensorcentral-sensordetails with parts <${parts.join()}>`);
            require("./sensorcentral-sensordetails")(document, elemRoot, {"houseId": parts[2], "deviceId": parts[4], "sensorId": parts[6]});
        }
    } else {
        elemRoot.html(`<h1>Oh no!!</h1>
        <p>
            Something went wrong or you requested an unknown page.
        </p>`);
    }
};
window.addEventListener("DOMContentLoaded", navigationChange);
window.addEventListener("hashchange", navigationChange);

