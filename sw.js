/* ═══════════════════════════════════════════════════
   📱 Service Worker - دفتر انضباطی (نسخه هوشمند)
   ═══════════════════════════════════════════════════ */

var CACHE_NAME = 'discipline-book-v23'; // release.bat این را تغییر می‌دهد
var CACHE_FILES = [
    './',
    './index.html',
    './teacher.html',
    './manifest.json',
    './manifest-teacher.json',
    './icon-t-192.png',
    './icon-t-512.png',
    './apple-touch-icon-t.png',
    './icon-192.png',
    './icon-512.png',
    './icon-maskable-512.png',
    './apple-touch-icon.png',
    './favicon.png'
];

// ===== نصب =====
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(CACHE_FILES);
        })
    );
    self.skipWaiting(); // نصب فوری نسخه جدید
});

// ===== فعال‌سازی =====
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(names) {
            return Promise.all(
                names.filter(function(name) {
                    return name !== CACHE_NAME;
                }).map(function(name) {
                    return caches.delete(name);
                })
            );
        })
    );
    self.clients.claim(); // کنترل فوری تمام تب‌ها
});

// ===== دریافت (Fetch) =====
self.addEventListener('fetch', function(event) {
    if (event.request.method !== 'GET') return;

    var reqUrl = new URL(event.request.url);
    if (reqUrl.origin !== self.location.origin) return;

    // ⚡️ استراتژی Network-First برای فایل‌های اصلی (تا همیشه نسخه جدید لود شود)
    var isCoreFile = reqUrl.pathname.endsWith('/') || 
                     reqUrl.pathname.endsWith('index.html') || 
                     reqUrl.pathname.endsWith('teacher.html') ||
                     reqUrl.pathname.endsWith('version.json') ||
                     reqUrl.pathname.endsWith('licenses.json');

    if (isCoreFile) {
        event.respondWith(
            fetch(event.request).then(function(response) {
                // اگر آنلاین بودیم، نسخه جدید را کش کن و برگردان
                var responseClone = response.clone();
                caches.open(CACHE_NAME).then(function(cache) {
                    cache.put(event.request, responseClone);
                });
                return response;
            }).catch(function() {
                // اگر آفلاین بودیم، از کش برگردان
                return caches.match(event.request);
            })
        );
        return;
    }

    // 🔄 استراتژی Cache-First برای بقیه فایل‌ها (عکس‌ها، فونت‌ها و...)
    event.respondWith(
        caches.match(event.request).then(function(cached) {
            if (cached) return cached;
            return fetch(event.request).then(function(response) {
                if (!response || response.status !== 200 || response.type === 'opaque') return response;
                var responseClone = response.clone();
                caches.open(CACHE_NAME).then(function(cache) {
                    cache.put(event.request, responseClone);
                });
                return response;
            });
        })
    );
});