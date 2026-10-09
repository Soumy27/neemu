// Neemu's service worker. Its only job is to show a notification when the sapling
// sends one, and to open the sapling's page when the notification is tapped.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let note = {};
  try {
    note = event.data ? event.data.json() : {};
  } catch {
    note = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(note.title || "Neemu", {
      body: note.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: note.tag || "neemu",
      data: { url: note.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((open) => {
      const same = open.find((c) => c.url === url);
      return same ? same.focus() : self.clients.openWindow(url);
    }),
  );
});
