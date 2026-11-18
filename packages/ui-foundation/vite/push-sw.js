// The app's service worker, written by pwa() (./index.js) as /push-sw.js.
// Push and notification clicks only: no fetch handler, so it never caches
// the app or stands between it and Vite's hashed files. Registered by
// usePushPermission's enable(), not on load. ICON is set by pwa().
/* global self, clients */
const ICON = '__ICON__'
const ACTION = 'action'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// The app's own address for `path`, or null: a path with one leading /,
// no backslash or control character, that resolves to this origin. A
// payload naming anywhere else (https://..., //host, /\host) gets null, so
// the worker never opens or posts to another site.
function appUrl(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return null
  if (/[\\\u0000-\u001f]/.test(path)) return null
  let url
  try {
    url = new URL(path, self.location.origin)
  } catch {
    return null
  }
  return url.origin === self.location.origin ? url : null
}

// The payload's button (PushAction in foundation_backend.push), checked:
// a title, an app path and a JSON object body. Anything else is no button.
function readAction(action) {
  if (!action || typeof action !== 'object') return null
  const title = typeof action.title === 'string' ? action.title.trim().slice(0, 40) : ''
  const url = appUrl(action.path)
  if (!title || !url) return null
  const body = action.body && typeof action.body === 'object' && !Array.isArray(action.body) ? action.body : {}
  return { title, path: url.pathname + url.search, body }
}

// Whether this browser shows notification buttons. iOS Safari doesn't
// (no Notification.maxActions): it gets the notification without one.
function showsActions() {
  return typeof Notification !== 'undefined' && Number(Notification.maxActions) > 0
}

// foundation_backend.push sends {title, body, url, tag, renotify, action}.
// Anything else still shows.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  if (!data || typeof data !== 'object') data = {}
  const action = readAction(data.action)
  const options = { body: data.body || '', icon: ICON, data: { url: data.url || '/', action } }
  if (data.tag) {
    options.tag = data.tag
    // A nag re-sent under the same tag sounds again instead of replacing quietly.
    if (data.renotify === true) options.renotify = true
  }
  if (action && showsActions()) options.actions = [{ action: ACTION, title: action.title }]
  event.waitUntil(self.registration.showNotification(data.title || 'Reminder', options))
})

// Opens `target` in the app: in a window already open on the app if there
// is one, else a new one.
async function openApp(target) {
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
}

// The button: POSTs its body to the app's path with the session cookie,
// opening nothing. Done, the notification goes; refused or offline, it
// opens the message's path so the person can do it in the app.
async function runAction(notification, action, target) {
  const url = appUrl(action.path)
  let ok = false
  if (url) {
    try {
      const response = await fetch(url.href, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.body || {}),
      })
      ok = response.ok
    } catch {
      ok = false
    }
  }
  notification.close()
  if (!ok && target) await openApp(target)
}

// A tap opens the message's path; the button runs its action. Never
// another site.
self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data || {}
  const target = appUrl(data.url || '/')
  const action = event.action === ACTION ? readAction(data.action) : null
  if (action) {
    event.waitUntil(runAction(event.notification, action, target))
    return
  }
  event.notification.close()
  if (!target) return
  event.waitUntil(openApp(target))
})
