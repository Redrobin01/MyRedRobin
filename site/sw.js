/* My Red Robin: lets phones install the app. Always uses the network (so families see today's places);
   if the phone is offline, it shows a short message instead of a browser error. */
self.addEventListener("install", e => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => new Response(
    '<!DOCTYPE html><meta name="viewport" content="width=device-width,initial-scale=1"><title>My Red Robin</title>' +
    '<body style="font:17px system-ui;text-align:center;padding:60px 24px;color:#2a2622"><h2>No internet</h2>' +
    '<p>My Red Robin needs the internet. Please check your connection and try again.</p>' +
    '<button onclick="location.reload()" style="font:inherit;padding:12px 22px;border-radius:12px;border:0;background:#b9481f;color:#fff">Try again</button></body>',
    { headers: { "Content-Type": "text/html; charset=utf-8" } })));
});
