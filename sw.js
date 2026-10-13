// سرویس‌ورکر: بعد از اولین بازکردن، برنامه بدون اینترنت هم کار می‌کند
const CACHE = 'ums-v1';
const FILES = [
  './', 'index.html', 'style.css', 'app.js', 'geometry.js', 'scene.js', 'templates.js', 'draw.js', 'dxf.js', 'pdf.js',
  'manifest.webmanifest', 'lib/jspdf.umd.min.js', 'fonts/Vazirmatn-Regular.woff2', 'fonts/Vazirmatn-Bold.woff2',
  'icons/icon-192.png', 'icons/icon-512.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match('index.html'))),
  );
});
