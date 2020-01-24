const package = require('../../../package.json');
const nameVersion = `${package.name}-${package.version}-${Date.now()}`;

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/js/service-worker.js')
        .then(function() {
            console.log(`[ServiceWorker] Registered (${nameVersion})`); 
        });
}

window.SC = {};
window.SC.doChart = require("./democharts").doChart;
