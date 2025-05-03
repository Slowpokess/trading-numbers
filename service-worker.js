// Имя кэша
const CACHE_NAME = 'okx-p2p-calculator-v1';

// Ресурсы для кэширования
const CACHE_ASSETS = [
  '/',
  '/index.html',
  '/server.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Время жизни кэша для API-ответов (в миллисекундах)
const API_CACHE_TTL = 5 * 60 * 1000; // 5 минут

// Устанавливаем service worker и кэшируем основные ресурсы
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Кэширование статических ресурсов');
        return cache.addAll(CACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Активируем service worker и удаляем старые кэши
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.filter(cacheName => {
            return cacheName !== CACHE_NAME;
          }).map(cacheName => {
            return caches.delete(cacheName);
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Обрабатываем запросы
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Для API-запросов используем стратегию Network First с кэшированием на заданное время
  if (url.pathname.includes('/api/okx/')) {
    event.respondWith(networkFirstWithTTL(event.request));
  } 
  // Для остальных запросов используем стратегию Cache First
  else {
    event.respondWith(cacheFirst(event.request));
  }
});

// Стратегия Cache First для статических ресурсов
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    // Кэшируем только успешные ответы
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Если нет ни кэша, ни сети, возвращаем ошибку
    return new Response('Network error', { status: 408, headers: new Headers({ 'Content-Type': 'text/plain' }) });
  }
}

// Стратегия Network First с TTL для API-запросов
async function networkFirstWithTTL(request) {
  try {
    // Пытаемся получить данные из сети
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Если ответ получен, кэшируем его с временной меткой
      const clonedResponse = networkResponse.clone();
      
      // Создаем объект для хранения
      const cacheData = {
        response: await clonedResponse.blob(),
        timestamp: Date.now(),
        contentType: clonedResponse.headers.get('Content-Type')
      };
      
      // Сохраняем в кэше
      const cache = await caches.open(CACHE_NAME);
      
      // Создаем новый объект Response для сохранения в кэше
      const cachedResponseObj = new Response(cacheData.response, {
        headers: { 
          'X-Cached-At': cacheData.timestamp.toString(),
          'Content-Type': cacheData.contentType
        }
      });
      
      cache.put(request, cachedResponseObj);
      
      return networkResponse;
    }
    
    // Если получен не успешный ответ, проверяем кэш
    throw new Error('Network response was not ok');
  } catch (error) {
    // При ошибке сети пытаемся взять из кэша
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      // Проверяем время кэширования
      const cachedAt = parseInt(cachedResponse.headers.get('X-Cached-At'));
      const now = Date.now();
      
      // Если данные свежие, возвращаем их
      if (now - cachedAt < API_CACHE_TTL) {
        return cachedResponse;
      }
    }
    
    // Если нет свежих данных в кэше, возвращаем ошибку
    return new Response('{"error": "Network and cache data unavailable"}', { 
      status: 503, 
      headers: new Headers({ 'Content-Type': 'application/json' }) 
    });
  }
}