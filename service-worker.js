// Импортируем Workbox
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

// Проверяем поддержку Workbox
if (!workbox) {
    console.error('Workbox не загрузился!');
    // Можно показать уведомление пользователю или просто выйти
    // throw new Error('Workbox не загрузился!');
}

// Устанавливаем префиксы имен кэшей
workbox.core.setCacheNameDetails({
    prefix: 'bed-counter',
    suffix: 'v1.3', // Увеличиваем версию для инвалидации кэша при изменениях
    precache: 'precache',
    runtime: 'runtime',
});

// Версия кэша для контроля обновлений (если используется вручную)
const CACHE_VERSION = 'v1.3'; // Синхронизируем с suffix

// Список файлов для предварительного кэширования
// Убедитесь, что все необходимые ресурсы включены
// Пути относительно корня сайта: https://ваш-логин.github.io/Mybed/
const precacheFiles = [
    '/Mybed/', // или '/Mybed/index.html'
    '/Mybed/index.html',
    '/Mybed/offline.html',
    '/Mybed/manifest.json',
    '/Mybed/android-chrome-192x192.png',
    '/Mybed/android-chrome-512x512.png'
    // Добавьте сюда другие важные статические ресурсы, если они есть
];

// Предварительное кэширование важных файлов
workbox.precaching.precacheAndRoute(precacheFiles.map(url => ({
    url, // URL для кэширования
    revision: CACHE_VERSION // Используем нашу версию для инвалидации
})));

// --- Стратегии для Runtime кэширования ---

// Кэширование шрифтов Google Fonts (StaleWhileRevalidate)
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

// Кэширование внешних скриптов/стилей (например, Font Awesome)
workbox.routing.registerRoute(
    /^https:\/\/cdnjs\.cloudflare\.com/,
    new workbox.strategies.StaleWhileRevalidate({
        cacheName: 'cdn-scripts',
    })
);

// Кэширование изображений (CacheFirst)
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

// --- Стратегия для ОСНОВНОЙ СТРАНИЦЫ (index.html) ---
// Это ключевое изменение для "незаметного" офлайн-режима
workbox.routing.registerRoute(
    // Соответствует основной странице.
    ({ request }) => request.mode === 'navigate',
    // Используем стратегию CacheFirst
    new workbox.strategies.CacheFirst({
        cacheName: 'pages',
        plugins: [
            // Плагин для ограничения количества записей в кэше навигации
            new workbox.expiration.ExpirationPlugin({
                maxEntries: 20,
            }),
            // Обработчик ошибок
            new workbox.cacheableResponse.CacheableResponsePlugin({
                statuses: [0, 200],
            }),
        ]
    })
);

// --- Обработчики жизненного цикла Service Worker ---

// Обработка установки новой версии Service Worker
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Установка');
    // Принудительная активация без ожидания
    self.skipWaiting();
});

// Обработка активации Service Worker
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Активация');
    
    // Очистка старых кэшей
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(cacheName => {
                    // Очищаем кэши с тем же префиксом, но другой версией
                    return cacheName.startsWith('bed-counter-') && 
                           !cacheName.includes(CACHE_VERSION); // Проверяем по версии
                }).map(cacheName => {
                     console.log('[Service Worker] Удаление старого кэша:', cacheName);
                    return caches.delete(cacheName);
                })
            );
        }).then(() => {
             // Получение контроля сразу после активации
            return clients.claim();
        })
    );
});

// Обработка сообщений от клиентского кода (например, для обновления)
self.addEventListener('message', (event) => {
    console.log('[Service Worker] Получено сообщение:', event.data);
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[Service Worker] Пропуск ожидания');
        self.skipWaiting();
    }
});

// Обработчик fetch для резервных вариантов (например, если precache не сработал)
// Этот обработчик будет срабатывать для запросов, которые НЕ обрабатываются
// правилами workbox.routing.registerRoute выше.
self.addEventListener('fetch', (event) => {
    // Обрабатываем только GET-запросы
    if (event.request.method !== 'GET') {
        return;
    }

    // Для навигационных запросов (переходы по страницам)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            // Сначала пробуем кэш
            caches.match(event.request)
                .then(response => {
                    // Если в кэше есть, возвращаем его
                    if (response) {
                        return response;
                    }
                    // Если нет в кэше, пробуем сеть
                    return fetch(event.request)
                        .catch(() => {
                            // Если и сеть не удался, показываем офлайн-страницу
                            return caches.match('/Mybed/offline.html'); // Путь от корня сайта
                        });
                })
        );
    }
    // Для других ресурсов Workbox уже обрабатывает через registerRoute
    // Этот обработчик fetch служит резервом и для навигации.
});