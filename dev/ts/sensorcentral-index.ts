import "./styles";
import * as pckg from "../../package.json";
import * as uiutils from "./ui-utils";
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
import calloutsRoute from "./routes/callouts";
import calloutEditRoute from "./routes/callout-edit";
import eventlogRoute from "./routes/eventlog";
import cronjobsRoute from "./routes/cronjobs";
import cronjobCreateRoute from "./routes/cronjob-create";
import cronjobEditRoute from "./routes/cronjob-edit";
import houseCreateRoute from "./routes/house-create";
import houseEditRoute from "./routes/house-edit";
import deviceCreateRoute from "./routes/device-create";
import deviceEditRoute from "./routes/device-edit";
import sensorCreateRoute from "./routes/sensor-create";
import sensorEditRoute from "./routes/sensor-edit";
import endpointCreateRoute from "./routes/endpoint-create";
import endpointEditRoute from "./routes/endpoint-edit";
import secretCreateRoute from "./routes/secret-create";
import secretEditRoute from "./routes/secret-edit";
import authenticatorCreateRoute from "./routes/authenticator-create";
import authenticatorEditRoute from "./routes/authenticator-edit";
import eventdefCreateRoute from "./routes/eventdef-create";
import eventdefEditRoute from "./routes/eventdef-edit";
import eventCreateRoute from "./routes/event-create";
import eventEditRoute from "./routes/event-edit";
import manualSampleRoute from "./routes/manual-sample";
import endpointTestChart from "./routes/testchart";

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
        await loginChooseRoute(elemRoot);
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
    } else if (hash === "#callouts") {
        calloutsRoute(elemRoot);
    } else if (hash === "#callouts/create") {
        calloutEditRoute(elemRoot);
    } else if (hash.startsWith("#callouts/edit/")) {
        const calloutId = hash.split("/")[2];
        calloutEditRoute(elemRoot, calloutId);
    } else if (hash === "#endpoints/create") {
        endpointCreateRoute(elemRoot);
    } else if (hash.startsWith("#endpoints/edit/")) {
        endpointEditRoute(elemRoot, hash.split("/")[2]);
    } else if (hash === "#secrets/create") {
        secretCreateRoute(elemRoot);
    } else if (hash.startsWith("#secrets/edit/")) {
        secretEditRoute(elemRoot, hash.split("/")[2]);
    } else if (hash === "#authenticators/create") {
        authenticatorCreateRoute(elemRoot);
    } else if (hash.startsWith("#authenticators/edit/")) {
        authenticatorEditRoute(elemRoot, hash.split("/")[2]);
    } else if (hash.startsWith("#eventdefs/create/")) {
        const parts = hash.split("/");
        eventdefCreateRoute(elemRoot, parts[2], parts[3]);
    } else if (hash.startsWith("#eventdefs/edit/")) {
        const parts = hash.split("/");
        eventdefEditRoute(elemRoot, parts[2], parts[3], parts[4]);
    } else if (hash.startsWith("#events/create/")) {
        eventCreateRoute(elemRoot, hash.split("/")[2]);
    } else if (hash.startsWith("#events/edit/")) {
        const parts = hash.split("/");
        eventEditRoute(elemRoot, parts[2], parts[3]);
    } else if (hash.startsWith("#samples/create/")) {
        manualSampleRoute(elemRoot, hash.split("/")[2]);
    } else if (hash === "#eventlog") {
        eventlogRoute(elemRoot);
    } else if (hash === "#cronjobs") {
        cronjobsRoute(elemRoot);
    } else if (hash === "#cronjobs/create") {
        cronjobCreateRoute(elemRoot);
    } else if (hash.startsWith("#cronjobs/edit/")) {
        const jobId = hash.split("/")[2];
        cronjobEditRoute(elemRoot, jobId);

    } else if (hash === "#powermeter/charts") {
        powerChartsRoute(elemRoot);
    } else if (hash.indexOf("#configuration") === 0) {
        const parts = hash.split("/");
        if (parts.length === 3 && parts[1] === "houses" && parts[2] === "create") {
            houseCreateRoute(elemRoot);
        } else if (parts.length === 2 && parts[1] === "houses") {
            log.debug(`Rendering sensorcentral-houses with parts <${parts.join()}>`);
            housesRoute(elemRoot);
        } else if (parts.length === 4 && parts[1] === "house" && parts[3] === "edit") {
            houseEditRoute(elemRoot, parts[2]);
        } else if (parts.length === 5 && parts[1] === "house" && parts[3] === "device" && parts[4] === "create") {
            deviceCreateRoute(elemRoot, parts[2]);
        } else if (parts.length === 6 && parts[1] === "house" && parts[3] === "device" && parts[5] === "edit") {
            deviceEditRoute(elemRoot, parts[2], parts[4]);
        } else if (parts.length === 7 && parts[1] === "house" && parts[3] === "device" && parts[5] === "sensor" && parts[6] === "create") {
            sensorCreateRoute(elemRoot, parts[2], parts[4]);
        } else if (parts.length === 8 && parts[1] === "house" && parts[3] === "device" && parts[5] === "sensor" && parts[7] === "edit") {
            sensorEditRoute(elemRoot, parts[2], parts[4], parts[6]);
        } else if (parts.length === 3 && parts[1] === "house") {
            log.debug(`Rendering sensorcentral-devices with parts <${parts.join()}>`);
            devicesRoute(elemRoot, parts[2]);
        } else if (parts.length === 5 && parts[1] === "house" && parts[3] === "device") {
            log.debug(`Rendering sensorcentral-sensors with parts <${parts.join()}>`);
            sensorsRoute(elemRoot, parts[2], parts[4]);
        } else if (parts.length === 7 && parts[1] === "house" && parts[3] === "device" && parts[5] === "sensor") {
            log.debug(`Rendering sensorcentral-sensordetails with parts <${parts.join()}>`);
            sensordetailsRoute(elemRoot, parts[6]);
        }
    } else if (hash === "#testchart") {
        endpointTestChart(elemRoot);
    } else {
        elemRoot.html(`<h1>Oh no!!</h1>
        <p>
            Something went wrong or you requested an unknown page.
        </p>`);
    }
}

window.addEventListener("DOMContentLoaded", navigationChange);
window.addEventListener("hashchange", navigationChange);