// The app's service worker, written by pwa() (./index.js) as /push-sw.js.
// Push and notification clicks only: no fetch handler, so it never caches
// the app or stands between it and Vite's hashed files. Registered by
// usePushPermission's enable(), not on load. ICON is set by pwa().
/* global self, clients */
const ICON = '__ICON__'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// app/push.py sends {title, body, url, tag}. Anything else still shows.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const options = { body: data.body || '', icon: ICON, data: { url: data.url || '/' } }
  if (data.tag) options.tag = data.tag
  event.waitUntil(self.registration.showNotification(data.title || 'Reminder', options))
})

// Opens the message's path in the app: in a window already open on the
// app if there is one, else a new one. Never another site.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin)
  if (target.origin !== self.location.origin) return
  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows.find((client) => new URL(client.url).origin === target.origin)
      if (open) {
        await open.focus()
        try {
          await open.navigate(target.href)
          return
        } catch {
          // An uncontrolled window can't be navigated from here.
        }
      }
      await clients.openWindow(target.href)
    })(),
  )
})
