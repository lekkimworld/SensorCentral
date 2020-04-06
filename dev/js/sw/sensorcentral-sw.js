const package = require('../../../package.json');
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
    "/css/styles.css",
    "/js/index.js",
    "/js/bootstrap.bundle.min.js",
    "/js/jquery.min.js"
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

self.addEventListener('fetch', function(event) {
    if (event.request.url.indexOf("/api/v1/login") > 0) {
        console.log("Service worker deteced login request");
        event.respondWith(fetch(event.request).catch(err => {
            const resp = new Response(JSON.stringify({"error": true, "message": "You are not online and cannot login."}));
            resp.headers.set("Content-Type", "application/json");
            return resp;
        }));
    } else if (event.request.url.indexOf("/api/v1/data/samples") >= 1) {
        event.respondWith(fetch(event.request).catch(err => {
            return new Response(`[{"id":"sensor_foo","dt":"2020-04-24T07:23:34.567Z","dt_string":"24-4-2020 kl. 8:23","value":24.123},{"id":"sensor_foo","dt":"2020-04-24T07:23:34.567Z","dt_string":"24-4-2020 kl. 8:23","value":24.123},{"id":"sensor_foo","dt":"2020-04-23T20:10:36.919Z","dt_string":"23-4-2020 kl. 21:10","value":19.8},{"id":"sensor_foo","dt":"2020-04-23T20:04:43.187Z","dt_string":"23-4-2020 kl. 21:04","value":22.22}]`);
        }));
    } else {
        event.respondWith(
            caches.match(event.request, {ignoreSearch:true}).then(response => {
                return response || fetch(event.request);
            }).catch(err => {
                
            })
        );
    }
});
