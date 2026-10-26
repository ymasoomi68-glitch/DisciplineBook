// make-version.js
// اجرا: node make-version.js
//  ۱) APP_VERSION را از index.html و teacher.html می‌خواند و باید یکسان باشند.
//  ۲) CACHE_NAME داخل sw.js را بر اساس نسخه + محتوای فایل‌های کش‌شده خودکار به‌روز می‌کند
//     (تا با هر تغییری در فایل‌ها، sw.js هم تغییر کند و مرورگر نسخهٔ جدید را نصب کند).
//  ۳) version.json را می‌سازد.
const fs = require('fs');
const crypto = require('crypto');

const TEXT_EXT = /\.(html|json|js|txt|css|svg)$/i;
function readNorm(f) {
    // فایل‌های متنی: CRLF → LF تا هش روی ویندوز و لینوکس یکسان باشد
    const buf = fs.readFileSync(f);
    return TEXT_EXT.test(f) ? Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8') : buf;
}
function fail(msg) { console.error('❌ ' + msg); process.exit(1); }

// ───── ۱) نسخهٔ برنامه (باید در هر دو فایل یکی باشد) ─────
function getVersion(f) {
    if (!fs.existsSync(f)) fail(`فایل ${f} پیدا نشد.`);
    const m = fs.readFileSync(f, 'utf8').match(/\bvar\s+APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
    return m ? m[1] : null;
}
const vIndex = getVersion('index.html');
const vTeacher = getVersion('teacher.html');
if (!vIndex) fail('APP_VERSION در index.html پیدا نشد.');
if (!vTeacher) fail('APP_VERSION در teacher.html پیدا نشد.');
if (vIndex !== vTeacher) fail(`نسخهٔ دو برنامه یکسان نیست: index.html = ${vIndex} ، teacher.html = ${vTeacher}. هر دو را یکی کنید و دوباره اجرا کنید.`);
const version = vIndex;

// ───── ۲) CACHE_NAME خودکار در sw.js ─────
const swSrc = fs.readFileSync('sw.js', 'utf8');
const listMatch = swSrc.match(/var\s+CACHE_FILES\s*=\s*\[([\s\S]*?)\]/);
if (!listMatch) fail('لیست CACHE_FILES در sw.js پیدا نشد.');
const cacheFiles = [...listMatch[1].matchAll(/['"]\.\/([^'"]+)['"]/g)].map(m => m[1]);   // './' (ریشه) نادیده گرفته می‌شود
const hash = crypto.createHash('sha256');
for (const f of cacheFiles.slice().sort()) {
    if (!fs.existsSync(f)) continue;
    hash.update(f + '\0');
    hash.update(readNorm(f));
    hash.update('\0');
}
const cacheName = 'discipline-book-v' + version + '-' + hash.digest('hex').slice(0, 8);
const nameRe = /var CACHE_NAME = '[^']*';/;
if (!nameRe.test(swSrc)) fail('خط CACHE_NAME در sw.js پیدا نشد.');
const swNew = swSrc.replace(nameRe, `var CACHE_NAME = '${cacheName}';`);
if (swNew !== swSrc) {
    fs.writeFileSync('sw.js', swNew);
    console.log(`🔄 CACHE_NAME در sw.js به‌روز شد: ${cacheName}`);
} else {
    console.log(`ℹ️ CACHE_NAME تغییری نکرد: ${cacheName}`);
}

// ───── ۳) version.json ─────
const files = ['index.html', 'teacher.html', 'sw.js', 'manifest.json', 'manifest-teacher.json'];
const sha256 = {};
for (const f of files) {
    if (fs.existsSync(f)) {
        const data = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');   // sw.js بعد از بازنویسی CACHE_NAME خوانده می‌شود
        sha256[f] = crypto.createHash('sha256').update(data, 'utf8').digest('hex');
    }
}

// تغییرات این نسخه: از فایل release-notes.txt (هر خط یک تغییر) خوانده می‌شود و در «تنظیمات ← به‌روزرسانی برنامه» نشان داده می‌شود.
// اگر فایل نبود یا خالی بود، متن پیش‌فرض نوشته می‌شود.
let notes = [];
if (fs.existsSync('release-notes.txt')) {
    notes = fs.readFileSync('release-notes.txt', 'utf8')
        .replace(/^﻿/, '')
        .split(/\r?\n/)
        .map(l => l.replace(/^\s*[-•*]\s*/, '').trim())
        .filter(Boolean);
}
if (!notes.length) notes = ["به‌روزرسانی خودکار"];

fs.writeFileSync('version.json', JSON.stringify({
    app: 'discipline-book',
    version,
    notes,
    files,
    sha256,
    cache: cacheName,
    date: new Date().toISOString().slice(0, 10)
}, null, 2));

console.log(`✅ version.json برای نسخهٔ ${version} ساخته شد (${notes.length} مورد تغییرات).`);
