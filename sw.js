// Hühnerbuch – Offline-Speicher der App-Dateien (nicht der Daten!)
const CACHE = "huehnerbuch-v4";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png",
  "./sc-hellbraun.png", "./sc-gruen.png", "./sc-creme.png"];
// Nur eine Seite, die diesen Text enthält, ist wirklich das Hühnerbuch.
const MARKER = "huehnerbuch.v1";

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Prüft, ob eine Antwort vom Server wirklich ein Teil dieser App ist.
// Schützt davor, dass eine fremde Seite (gelöschte Webseite, WLAN-Anmeldeseite …)
// die gespeicherte App überschreibt.
async function trustworthy(res, isPage) {
  if (!res || !res.ok || res.redirected || res.type !== "basic") return false;
  const type = res.headers.get("content-type") || "";
  if (isPage) return type.includes("text/html") && (await res.clone().text()).includes(MARKER);
  return !type.includes("text/html");
}

// Erst aus dem Speicher (sofort, auch offline), im Hintergrund still aktualisieren.
self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  const isPage = req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("/index.html");
  const key = isPage ? "./index.html" : req;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(key, { ignoreSearch: true });
    const net = fetch(req).then(async res => {
      if (await trustworthy(res, isPage)) { await c.put(key, res.clone()); return res; }
      return null;
    }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || new Response("Offline – bitte einmal mit Internet öffnen.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
  }));
});
