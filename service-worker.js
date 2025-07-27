// Импортируем Workbox
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

// Проверяем поддержку Workbox
if (!workbox) {
    console.error('Workbox не загрузился!');
    throw new Error('Workbox не загрузился!');
}

// Устанавливаем префиксы имен кэшей
workbox.core.setCacheNameDetails({
    prefix: 'bed-counter',
    suffix: 'v1.2', // Увеличивайте версию при изменениях
    precache: 'precache',
    runtime: 'runtime',
});

// Версия кэша для контроля обновлений
const CACHE_VERSION = 'v1.2';

// Список файлов для предварительного кэширования
// Убедитесь, что все необходимые ресурсы включены
const precacheFiles = [
    '/', // Главная страница
    '/index.html',
    '/offline.html',
    '/manifest.json',
    '/android-chrome-192x192.png',
    '/android-chrome-512x512.png'
];

// Предварительное кэширование важных файлов
workbox.precaching.precacheAndRoute(precacheFiles.map(url => ({
    url,
    revision: CACHE_VERSION
})));

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
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 год
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
    /\.(?:png|gif|jpg|jpeg|webp|svg)$/,
    new workbox.strategies.CacheFirst({
        cacheName: 'images',
        plugins: [
            new workbox.expiration.ExpirationPlugin({
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 дней
            }),
        ],
    })
);

// Стратегия для ОСНОВНОЙ СТРАНИЦЫ (index.html)
// Используем CacheFirst для index.html
workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    new workbox.strategies.CacheFirst({
        cacheName: 'pages',
        plugins: [
            new workbox.expiration.ExpirationPlugin({
                maxEntries: 20,
            }),
            new workbox.cacheableResponse.CacheableResponsePlugin({
                statuses: [0, 200],
            }),
        ],
        fetchOptions: {
            // Не ждем сеть, если кэш есть
        }
    })
);

// Обработка установки новой версии Service Worker
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Установка');
    self.skipWaiting();
});

// Обработка активации Service Worker
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Активация');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(cacheName => {
                    return cacheName.startsWith('bed-counter-') && 
                           !precacheFiles.some(f => cacheName.includes(f.url || f));
                }).map(cacheName => {
                     return caches.delete(cacheName);
                })
            );
        }).then(() => {
            return clients.claim();
        })
    );
});

// Обработка сообщений от клиентского кода
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});