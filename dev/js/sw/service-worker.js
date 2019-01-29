const package = require('../../../package.json');
const filesToCache = [
    '/',
    '/css/styles.css'
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
