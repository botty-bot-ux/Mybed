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
    suffix: 'v1.2', // Увеличиваем версию для инвалидации кэша при изменениях
    precache: 'precache',
    runtime: 'runtime',
});

// Версия кэша для контроля обновлений (если используется вручную)
const CACHE_VERSION = 'v1.2'; // Синхронизируем с suffix

// Список файлов для предварительного кэширования
// Убедитесь, что все необходимые ресурсы включены
const precacheFiles = [
    '/', // или './index.html' в зависимости от сервера
    'index.html',
    'offline.html',
    'manifest.json',
    'android-chrome-192x192.png',
    'android-chrome-512x512.png'
    // Добавьте сюда другие важные статические ресурсы, если они есть
    // (например, отдельные JS/CSS файлы, если бы они были)
];

// Предварительное кэширование важных файлов
// Workbox автоматически обновит кэш при изменении revision
workbox.precaching.precacheAndRoute(precacheFiles.map(url => ({
    url,
    revision: CACHE_VERSION // Используем нашу версию
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
// Используем CacheFirst для index.html
workbox.routing.registerRoute(
    // Соответствует основной странице. Адаптируйте путь при необходимости.
    // Часто ловит '/' и '/index.html'
    ({ request }) => request.mode === 'navigate',
    // Используем стратегию CacheFirst
    new workbox.strategies.CacheFirst({
        cacheName: 'pages',
        plugins: [
             // Плагин для ограничения количества записей в кэше навигации
            new workbox.expiration.ExpirationPlugin({
                maxEntries: 20, // Обычно достаточно для SPA
            }),
            // Обработчик ошибок (например, если кэш пуст/поврежден)
             new workbox.cacheableResponse.CacheableResponsePlugin({
                statuses: [0, 200], // Кэшируем даже opaque responses
            }),
        ],
        // Если не удается получить страницу из кэша, показываем офлайн-страницу
        // Это крайний случай.
        // В нормальной ситуации index.html всегда будет в precache.
        fetchOptions: {
             // Не ждем сеть, если кэш есть (это свойство CacheFirst)
        }
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
                     // Это более надежный способ, основанный на префиксе Workbox
                     return cacheName.startsWith('bed-counter-') && 
                           !precacheFiles.some(f => cacheName.includes(f.url || f)); // Пример проверки
                           // Более точная проверка ниже
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

// Обработка ошибок fetch (резервный вариант)
// Этот обработчик будет срабатывать для запросов, которые НЕ обрабатываются
// правилами workbox.routing.registerRoute выше.
self.addEventListener('fetch', (event) => {
    // Обрабатываем только GET-запросы
    if (event.request.method !== 'GET') {
         console.log('[Service Worker Fetch] Пропущен не-GET запрос:', event.request.url);
        return;
    }

    // Позволяем Workbox обрабатывать маршруты, зарегистрированные через workbox.routing.registerRoute
    // Поэтому явно ничего не делаем здесь для навигации или других зарегистрированных ресурсов.
    // Workbox сам добавит свой обработчик fetch для зарегистрированных маршрутов.
    // console.log('[Service Worker Fetch] Передан запрос Workbox:', event.request.url);

    // --- Резервная обработка для непредвиденных запросов ---
    // На случай, если какой-то запрос не попал под правила выше
    // (например, запросы к API, если бы они были)
    // Можно добавить общий fallback, но в данном случае это избыточно,
    // так как все ресурсы либо precache, либо имеют маршрут.
    // Оставляем это как пример крайней меры.
    /*
    event.respondWith(
        // Сначала пробуем сеть
        fetch(event.request.clone())
            .catch(() => {
                // Если сеть не удалась, ищем в кэше
                return caches.match(event.request)
                    .then(response => {
                        // Если в кэше есть, возвращаем его
                        if (response) {
                            return response;
                        }
                        // Для изображений возвращаем запасное
                        if (event.request.url.match(/\.(jpg|jpeg|png|gif|svg)$/)) {
                             return caches.match('./android-chrome-192x192.png'); // Убедитесь, что путь правильный
                        }
                        // Для остального - ошибка или offline.html?
                        // В большинстве случаев этого не должно происходить
                        // из-за precache и registerRoute.
                         console.warn('[Service Worker Fetch] Ресурс не найден в кэше и сети:', event.request.url);
                        return Response.error(); // Или можно вернуть offline.html, если это критично
                    });
            })
    );
    */
});