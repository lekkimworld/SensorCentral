const package = require('../../package.json');
const filesToCache = [
    "/",
    "/manifest.json",
    "/images/icon-32.png",
    "/images/icon-76.png",
    "/images/icon-120.png",
    "/images/icon-128.png",
    "/images/icon-152.png",
    "/images/icon-180.png",
    "/images/icon-192.png",
    "/images/icon-332.png",
    "/fonts/fontawesome-webfont.woff",
    "/fonts/fontawesome-webfont.woff2",
    "/js/bootstrap.bundle.min.js",
    "/js/moment-with-locales.min.js",
    "/js/bootstrap-datetimepicker.min.js",
    "/css/styles.css",
    "/js/bundle.js"
];
const nameVersion = `${package.name}-${package.version}-${Date.now()}`;

self.addEventListener('install', function(e) {
    console.log(`[ServiceWorker] Install (${nameVersion})`)
    e.waitUntil(
        caches.open(nameVersion).then(function(cache) {
            console.log('[ServiceWorker] Caching app shell');
            return cache.addAll(filesToCache);
        })
    );
});

self.addEventListener('activate', function(e) {
    console.log(`[ServiceWorker] Activate (${nameVersion})`);
    e.waitUntil(
        caches.keys().then(function(keyList) {
            return Promise.all(keyList.map(function(key) {
            if (key !== nameVersion) {
                console.log('[ServiceWorker] Removing old cache', key);
                return caches.delete(key);
            }
            }));
        })
    );
    return self.clients.claim();
});
