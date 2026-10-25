const CACHE_NAME = "lida-shell-v10";
const APP_SHELL = [
  "./", "./index.html", "./manifest.webmanifest",
  "./app.js", "./demo-data.js", "./storage.js", "./supabase-auth.js", "./supabase-config.js",
  "./navigation.js", "./dialogs.js",
  "./tokens.css", "./base.css", "./components.css", "./supabase-auth.css",
  "./lida-mark.svg", "./lida-logo-original.png", "./lida-interface-reference.png"
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)); }
    return response;
  }).catch(() => caches.match("./index.html"))));
});
