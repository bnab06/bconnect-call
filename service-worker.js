// service-worker.js
// Reçoit les notifications push envoyées par le serveur BnB Connect
// (Python, via pywebpush) quand un appel est créé, et les affiche même si
// l'app n'est pas ouverte. Gère aussi le clic sur la notification, pour
// ramener au premier plan la fenêtre déjà ouverte (ou en ouvrir une
// nouvelle) — l'app affichera alors elle-même l'écran d'appel entrant
// habituel (bannière + sonnerie) une fois au premier plan.
//
// Types de messages push :
//  - "call_ring"   : appel entrant (répété tant que ça sonne, même "tag"
//                    ou "tag" distinct selon le réglage côté serveur).
//  - "call_missed" : l'appel n'a pas été décroché -> "Appel manqué" visible,
//                    et les notifications d'appel entrant disparaissent.
//  - "call_cancel" : l'appel a été décroché/refusé/terminé -> toutes les
//                    notifications de cet appel sont retirées. (iOS exige
//                    que chaque push affiche quelque chose : on affiche
//                    donc brièvement un message discret avant de le retirer.)

self.addEventListener("install", function (event) {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

function closeCallNotifications(callId, exceptTag) {
  // Ferme toutes les notifications dont le tag commence par "call-<id>",
  // sauf éventuellement celle dont le tag est exceptTag.
  const prefix = "call-" + callId;
  return self.registration.getNotifications().then(function (list) {
    list.forEach(function (n) {
      const tag = n.tag || "";
      if (tag.indexOf(prefix) === 0 && tag !== exceptTag) {
        n.close();
      }
    });
  });
}

self.addEventListener("push", function (event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "BnB Connect", body: "Nouvelle notification" };
  }

  const type = data.type || "call_ring";
  const title = data.title || "BnB Connect";
  const baseOptions = {
    body: data.body || "",
    icon: "icons/icon-192.png",
    badge: "icons/badge-96.png",
    data: data,
  };

  if (type === "call_cancel") {
    const options = Object.assign({}, baseOptions, {
      tag: data.tag || "call-end",
      silent: true,
    });
    event.waitUntil(
      self.registration
        .showNotification(title, options)
        .then(function () {
          return new Promise(function (resolve) { setTimeout(resolve, 1200); });
        })
        .then(function () {
          return closeCallNotifications(data.call_id, null);
        })
    );
    return;
  }

  if (type === "call_missed") {
    const options = Object.assign({}, baseOptions, {
      tag: data.tag,
      silent: false,
    });
    event.waitUntil(
      self.registration.showNotification(title, options).then(function () {
        return closeCallNotifications(data.call_id, data.tag);
      })
    );
    return;
  }

  // "call_ring" (et tout message sans type, par compatibilité)
  const options = Object.assign({}, baseOptions, {
    vibrate: [200, 100, 200, 100, 300],
    requireInteraction: true,
  });
  if (data.tag) {
    options.tag = data.tag;
    options.renotify = true; // rejoue le son/vibration si le même tag existe déjà
  }
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  const data = (event.notification && event.notification.data) || {};
  event.notification.close();
  event.waitUntil(
    (data.call_id ? closeCallNotifications(data.call_id, null) : Promise.resolve())
      .then(function () {
        return self.clients.matchAll({ type: "window", includeUncontrolled: true });
      })
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
