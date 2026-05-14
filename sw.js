const CACHE = "mia-v1";
const OFFLINE_ASSETS = ["/Mia-live-4-0/", "/Mia-live-4-0/index.html", "/Mia-live-4-0/script.js", "/Mia-live-4-0/styles.css"];

self.addEventListener("install",  e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(OFFLINE_ASSETS)).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(clients.claim()); });

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

// ── Push handler ──────────────────────────────────────────────────────────────
self.addEventListener("push", e => {
  let data = { title: "MIA 💜", body: "MIA har skrevet til dig", icon: "/Mia-live-4-0/assets/icon.png" };
  try { data = Object.assign(data, e.data?.json()); } catch (_) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.icon,
      vibrate: [200, 100, 200],
      data: { url: "/Mia-live-4-0/" }
    })
  );
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) { if (c.url.includes("Mia-live-4-0") && "focus" in c) return c.focus(); }
      return clients.openWindow(e.notification.data?.url || "/Mia-live-4-0/");
    })
  );
});
