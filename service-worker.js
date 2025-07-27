importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

workbox.core.setCacheNameDetails({
    prefix: 'bed-counter',
    suffix: 'v1',
    precache: 'precache',
    runtime: 'runtime',
});

workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);

// Кэширование шрифтов Google Fonts
workbox.routing.registerRoute(
    /^https:\/\/fonts\.googleapis\.com/,
    new workbox.strategies.StaleWhileRevalidate({
        cacheName: 'google-fonts-stylesheets',
    })
);

workbox.routing.registerRoute(
    /^https:\/\/fonts\.gstatic\.com/,
    new workbox.strategies.CacheFirst({
        cacheName: 'google-fonts-webfonts',
        plugins: [
            new workbox.cacheableResponse.CacheableResponsePlugin({
                statuses: [0, 200],
            }),
            new workbox.expiration.ExpirationPlugin({
                maxAgeSeconds: 60 * 60 * 24 * 365,
                maxEntries: 30,
            }),
        ],
    })
);

// Кэширование Font Awesome
workbox.routing.registerRoute(
    /^https:\/\/cdnjs\.cloudflare\.com/,
    new workbox.strategies.StaleWhileRevalidate({
        cacheName: 'cdn-scripts',
    })
);

// Кэширование изображений
workbox.routing.registerRoute(
    /\.(?:png|gif|jpg|jpeg|svg)$/,
    new workbox.strategies.CacheFirst({
        cacheName: 'images',
        plugins: [
            new workbox.expiration.ExpirationPlugin({
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 60 * 60,
            }),
        ],
    })
);

// Стратегия для HTML-документов
workbox.routing.registerRoute(
    ({request}) => request.mode === 'navigate',
    new workbox.strategies.NetworkFirst({
        cacheName: 'pages',
        plugins: [
            new workbox.expiration.ExpirationPlugin({
                maxEntries: 20,
            }),
        ],
    })
);

// Обработка офлайн-страницы
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});