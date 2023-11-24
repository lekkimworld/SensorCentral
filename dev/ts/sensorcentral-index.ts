import * as pckg from "../../package.json";
import * as uiutils from "../js/ui-utils";
import {ErrorForm} from "./forms-util";
import * as storage from "./storage-utils";
import {get} from "./fetch-util";
import rootRoute from "./routes/root";
import offlineRoute from "./routes/offline";
import loggedoutRoute from "./routes/loggedout";
import housesRoute from "./routes/houses";
import devicesRoute from "./routes/devices";
import sensorsRoute from "./routes/sensors";
import sensordetailsRoute from "./routes/sensordetails";
import aboutRoute from "./routes/about";
import loginChooseRoute from "./routes/login-choose";
import powerChartsRoute from "./routes/powermeter-charts";
import powerConfigRoute from "./routes/powermeter-config";

const log = {
    debug: (s:string) => {
        console.log(`DEBUG: ${s}`);
    },
    info: (s:string) => {
        console.log(`INFO: ${s}`);
    },
    warn: (s:string) => {
        console.log(`WARN: ${s}`);
    }
}

// register service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(function() {
        const nameVersion = `${pckg.name}-${pckg.version}-${Date.now()}`;
        log.info(`[ServiceWorker] Registered (${nameVersion})`);
    });
}

const showErrorForm = (err: Error) => {
    new ErrorForm(err).show();
}

const navigationChange = async () => {
    try {
        // set / clear username dropdown and menus
        uiutils.fillMenus();
    } catch (err) {
        showErrorForm(err);
        return;
    }

    // get hash
    const hash = document.location.hash;
    const path = document.location.pathname;

    if ("/openid/loggedin" === path) {
        // user has been logged it - go ask for a JWT based on us having a session
        try {
            const body = await get("/api/v1/login/jwt");
            storage.setUser(body);
            document.location.href = "/#root";
        } catch (err) {
            showErrorForm(err);
        }
    } else if (hash.indexOf("#house-") === 0) {
        // user is switching house
        const houseId = hash.substring(7);
        try {
            const body = await get(`/api/v1/login/jwt/${houseId}`);
            storage.setUser(body);
            document.location.href = "/#root";
        } catch(err) {
            showErrorForm(err);
        }
    }

    // build ui
    const elemRoot = $("#main-body");
    const user = storage.getUser();
    log.debug(`navigationChange - hash <${hash}>`);
    elemRoot.html("");

    if ("#login" === hash) {
        loginChooseRoute(elemRoot);
    } else if (hash.startsWith("#login-")) {
        // get provider
        const provider = hash.substring(7);
        log.debug(`Read provider from hash: ${provider}`);
        try {
            const body = await get(`/api/v1/login/${provider}`);
            log.debug(`Received URL for login back from API - redirecting to it...`);
            document.location.href = body.url;
        } catch (err) {
            log.warn(`Received error back from login api <${err.message}>`);
            offlineRoute(elemRoot);
        }
    } else if (!hash || "" === hash || "#root" === hash) {
        rootRoute(elemRoot);
    } else if ("#loggedout" === hash) {
        loggedoutRoute(elemRoot);
    } else if ("#about" === hash) {
        aboutRoute(elemRoot);
    } else if (hash.indexOf("#powermeter") === 0) {
        const parts = hash.split("/");
        if (parts[1] === "config") {
            powerConfigRoute(elemRoot);
        } else if (parts[1] === "charts") {
            powerChartsRoute(elemRoot);
        }
    } else if (hash.indexOf("#configuration") === 0) {
        const parts = hash.split("/");
        if (parts.length === 2 && parts[1] === "houses") {
            // list houses
            log.debug(`Rendering sensorcentral-houses with parts <${parts.join()}>`);
            housesRoute(elemRoot);
        } else if (parts.length === 3 && parts[1] === "house") {
            // list devices for house
            log.debug(`Rendering sensorcentral-devices with parts <${parts.join()}>`);
            devicesRoute(elemRoot, parts[2]);
        } else if (parts.length === 5 && parts[1] === "house" && parts[3] === "device") {
            // list sensors for device
            log.debug(`Rendering sensorcentral-sensors with parts <${parts.join()}>`);
            sensorsRoute(elemRoot, parts[2], parts[4]);
        } else if (parts.length === 7 && parts[1] === "house" && parts[3] === "device" && parts[5] === "sensor") {
            // sensor details
            log.debug(`Rendering sensorcentral-sensordetails with parts <${parts.join()}>`);
            /*
            {
                houseId: parts[2],
                deviceId: parts[4],
                sensorId: parts[6],
            }
            */
            sensordetailsRoute(elemRoot, parts[6]);
        }
    } else {
        elemRoot.html(`<h1>Oh no!!</h1>
        <p>
            Something went wrong or you requested an unknown page.
        </p>`);
    }
}

window.addEventListener("DOMContentLoaded", navigationChange);
window.addEventListener("hashchange", navigationChange);