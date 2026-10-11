// Salva l'app sul telefono così si apre anche senza internet.
var CACHE = "10elotto-v2";
var FILE = ["./", "index.html", "manifest.json", "icon.svg"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILE); }));
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (chiavi) {
    return Promise.all(chiavi.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});

// Prima prova internet (così le estrazioni sono sempre fresche), se manca usa l'ultima copia salvata.
self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  var chiave = url.origin + url.pathname; // senza "?t=..." così non si accumulano copie
  e.respondWith(
    fetch(e.request).then(function (r) {
      if (r.ok) {
        var copia = r.clone();
        caches.open(CACHE).then(function (c) { c.put(chiave, copia); });
      }
      return r;
    }).catch(function () { return caches.match(chiave); })
  );
});
