/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("push", (event) => {
  let data: { title?: string; body?: string; noteId?: string; url?: string } =
    {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { title: "Herinnering", body: event.data?.text() };
  }

  const title = data.title || "Ons Huisje";
  const url =
    data.url || (data.noteId ? "/stijnenhannah/#/notities" : "/stijnenhannah/");
  const options: NotificationOptions = {
    body: data.body || "Je hebt een nieuwe herinnering.",
    icon: "/stijnenhannah/icon.svg",
    badge: "/stijnenhannah/icon.svg",
    data: { url },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data?.url as string) || "/stijnenhannah/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});

self.skipWaiting();
self.addEventListener("activate", () => self.clients.claim());
