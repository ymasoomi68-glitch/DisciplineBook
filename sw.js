/* ═══════════════════════════════════════════════════
   📱 Service Worker - دفتر انضباطی
   ═══════════════════════════════════════════════════ */

var CACHE_NAME = 'discipline-book-v1.2.19-652de104'; // [auto] این خط را make-version.js خودکار به‌روز می‌کند (بر اساس محتوای فایل‌ها)؛ دستی تغییرش ندهید
var CACHE_PREFIX = 'discipline-book-'; // فقط کش‌های همین برنامه؛ به کش برنامه‌های دیگرِ همین دامنه دست نمی‌زنیم
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
// [auto-update] نسخهٔ جدید بعد از نصب موفق، خودش فوراً فعال می‌شود (skipWaiting)؛ برنامه آن را بی‌صدا اعمال می‌کند
// و تغییرات را در «تنظیمات ← به‌روزرسانی برنامه» نشان می‌دهد.
self.addEventListener('install', function(event) {
    console.log('🔄 Service Worker در حال نصب...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            // cache:'reload' → فایل‌ها حتماً از شبکه (نه از کش HTTP مرورگر) گرفته شوند تا نسخهٔ کهنه ذخیره نشود
            // هر فایل جداگانه: نبودِ یک آیکون کل کش را خراب نمی‌کند؛ ولی اگر صفحه‌های اصلی دریافت نشوند، نصب ناموفق می‌شود
            // (تا نسخهٔ ناقص نصب نشود و بعداً دوباره تلاش شود)
            var CORE = { './index.html': 1, './teacher.html': 1 };
            return Promise.all(CACHE_FILES.map(function(u) {
                return cache.add(new Request(u, { cache: 'reload' })).catch(function(err) {
                    console.log('کش نشد:', u, err);
                    if (CORE[u]) throw err;
                });
            }));
        })
    );
    // فعال‌سازی فقط بعد از پایان موفق نصب انجام می‌شود؛ اگر نصب خطا بدهد نسخهٔ قبلی دست‌نخورده می‌ماند
    self.skipWaiting();
});

// ===== فعال‌سازی =====
self.addEventListener('activate', function(event) {
    console.log('✅ Service Worker فعال شد');
    event.waitUntil((async function() {
        var names = await caches.keys();
        await Promise.all(
            names.filter(function(name) {
                return name.indexOf(CACHE_PREFIX) === 0 && name !== CACHE_NAME;
            }).map(function(name) {
                return caches.delete(name);
            })
        );
        await self.clients.claim();
    })());
});

// سازگاری با نسخه‌های قبلیِ برنامه که پیام SKIP_WAITING می‌فرستادند
self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// ===== دریافت =====
// صفحه‌ها (index.html / teacher.html): Stale-While-Revalidate
//   ← نسخهٔ کش‌شده فوراً نمایش داده می‌شود (سرعت بالا، کار آفلاین)
//   ← همزمان در پس‌زمینه نسخهٔ تازه از شبکه (بدون کش HTTP) گرفته و کش به‌روز می‌شود
//   پس حتی اگر sw.js بدون تغییر بماند، صفحهٔ جدید در بازشدن بعدی نمایش داده می‌شود.
// بقیهٔ فایل‌ها (آیکون و ...): Cache First.
// فقط از کش خودِ همین برنامه (CACHE_NAME) خوانده/نوشته می‌شود؛ به کش برنامه‌های دیگر دست نمی‌زنیم.
function isPageRequest(request, url) {
    return request.mode === 'navigate' || /\/(index\.html|teacher\.html)?$/.test(url.pathname);
}

function offlinePage(url) {
    var page = /teacher\.html$/.test(url.pathname) ? './teacher.html' : './index.html';
    return caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(new URL(page, self.location.href).href);
    });
}

function staleWhileRevalidate(event, url) {
    var key = url.origin + url.pathname;   // بدون پارامترهای آدرس
    return caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(key, { ignoreSearch: true }).then(function(cached) {
            if (cached) {
                // نسخهٔ کش‌شده را بده و در پس‌زمینه تازه‌سازی کن (waitUntil: اندروید سرویس‌ورکر را وسط کار نکشد)
                var refresh = fetch(key, { cache: 'reload' }).then(function(response) {
                    if (response && response.status === 200 && response.type === 'basic' && !response.redirected) {
                        return cache.put(key, response.clone());
                    }
                }).catch(function() { /* آفلاین یا خطا: نسخهٔ کش‌شده می‌ماند */ });
                event.waitUntil(refresh);
                return cached;
            }
            // هنوز در کش نیست: از شبکه بگیر و ذخیره کن
            return fetch(event.request).then(function(response) {
                if (response && response.status === 200 && response.type === 'basic' && !response.redirected) {
                    var rc = response.clone();
                    cache.put(key, rc);
                }
                return response;
            }).catch(function() {
                return offlinePage(url);
            });
        });
    });
}

self.addEventListener('fetch', function(event) {
    // فقط درخواست‌های GET رو کش کن
    if (event.request.method !== 'GET') return;

    // درخواست‌های API سیدا رو کش نکن
    if (event.request.url.indexOf('/api/') !== -1) return;

    var reqUrl = new URL(event.request.url);
    // درخواست‌های خارج از این سایت (مثل GitHub) را دست نزن
    if (reqUrl.origin !== self.location.origin) return;
    // فایل نسخه و لیست لایسنس همیشه از شبکه خوانده شود
    if (/\/(version|licenses)\.json$/.test(reqUrl.pathname)) return;

    // صفحه‌ها: Stale-While-Revalidate
    if (isPageRequest(event.request, reqUrl)) {
        event.respondWith(staleWhileRevalidate(event, reqUrl));
        return;
    }

    // بقیه: Cache First
    event.respondWith(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.match(event.request).then(function(cached) {
                // اگه توی کش هست، برگردون
                if (cached) return cached;

                // وگرنه از شبکه بگیر
                return fetch(event.request).then(function(response) {
                    // فقط پاسخ‌های موفق رو کش کن
                    if (!response || response.status !== 200 || response.type === 'opaque') {
                        return response;
                    }
                    cache.put(event.request, response.clone());
                    return response;
                }).catch(function() {
                    // اگه شبکه نبود، صفحهٔ اصلی رو برگردون
                    return offlinePage(reqUrl);
                });
            });
        })
    );
});
