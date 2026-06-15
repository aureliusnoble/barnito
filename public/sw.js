// Minimal service worker. Its only job is to make Barnito installable on Android
// (Chrome requires a registered SW with a fetch handler before it fires the
// `beforeinstallprompt` event). The app's data is realtime, so we deliberately do
// NOT cache responses — every request goes straight to the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
