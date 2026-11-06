/* Offline cache for the app screens. Data itself is cached by Firestore. */
var V = 'bb-v18';
var FILES = ['./', 'index.html', 'style.css', 'app.js', 'cloud.js', 'config.js', 'icon.png', 'manifest.json',
  'firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js', 'xlsx.full.min.js'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(V).then(function (c) { return c.addAll(FILES); })); self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== V; }).map(function (k) { return caches.delete(k); })); }));
  self.clients.claim();
});
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // network first so updates arrive; cache when offline
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(function (r) {
    var copy = r.clone(); caches.open(V).then(function (c) { c.put(e.request, copy); }); return r;
  }).catch(function () { return caches.match(e.request).then(function (m) { return m || caches.match('index.html'); }); }));
});
