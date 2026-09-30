// service-worker.js
// Reçoit les notifications push envoyées par le serveur BnB Connect
// (Python, via pywebpush) quand un appel est créé, et les affiche même si
// l'app n'est pas ouverte. Gère aussi le clic sur la notification, pour
// ramener au premier plan la fenêtre déjà ouverte (ou en ouvrir une
// nouvelle) — l'app affichera alors elle-même l'écran d'appel entrant
// habituel (bannière + sonnerie) une fois au premier plan.

self.addEventListener("install", function (event) {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", function (event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "BnB Connect", body: "Nouvelle notification" };
  }

  const title = data.title || "BnB Connect";
  const options = {
    body: data.body || "",
    icon: "icons/icon-192.png",
    badge: "icons/badge-96.png",
    vibrate: [200, 100, 200, 100, 300],
    requireInteraction: true,
    data: data,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        for (const client of clientList) {
          if ("focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow("./index.html");
        }
      })
  );
});
