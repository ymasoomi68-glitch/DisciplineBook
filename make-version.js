// make-version.js
const fs = require('fs');
const crypto = require('crypto');

const html = fs.readFileSync('index.html', 'utf8');
const vMatch = html.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
const version = vMatch ? vMatch[1] : '0.0.0';

const files = ['index.html', 'teacher.html', 'sw.js', 'manifest.json', 'manifest-teacher.json'];
const sha256 = {};
for (const f of files) {
    if (fs.existsSync(f)) {
        const data = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
        sha256[f] = crypto.createHash('sha256').update(data, 'utf8').digest('hex');
    }
}

fs.writeFileSync('version.json', JSON.stringify({
    app: 'discipline-book',
    version,
    notes: ["به‌روزرسانی خودکار"],
    files,
    sha256,
    date: new Date().toISOString().slice(0, 10)
}, null, 2));

console.log(`✅ version.json برای نسخهٔ ${version} ساخته شد.`);