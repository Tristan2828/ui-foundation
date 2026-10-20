import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AppError } from '@/api/contracts'
import {
  deletePushSubscription,
  getPushPublicKey,
  savePushSubscription,
  type PushSubscriptionRequest,
} from '@/api/gateway/push'

// Whether this device gets the app's reminders (Web Push), and the one
// control that changes it. It never asks on its own: `enable()` is for a
// click on a button that has already said what reminders are, and it asks
// the browser first thing, before any await, because Safari only shows the
// prompt during the click itself.
//
// The service worker (`push-sw.js`, written by the package's pwa() Vite
// plugin) is registered by `enable()`, not on page load. Under MSW the page
// is already controlled by MSW's worker at the same scope, and a second
// worker there would replace it, so with mocks this says 'mock' and does
// nothing. The rules live in createPushController, React-free, so they're
// unit tested against a fake browser (tests/use-push-permission.test.ts).

/**
 * - `unsupported`: this browser has no push.
 * - `needs-install`: iPhone or iPad in a browser tab; push works once the
 *   app is added to the Home Screen and opened from there.
 * - `mock`: the page runs on MSW; reminders need the real backend.
 * - `blocked`: the person said no; only the browser's site settings undo it.
 * - `off`: can be turned on. `on`: this device gets reminders.
 */
export type PushStatus = 'unsupported' | 'needs-install' | 'mock' | 'blocked' | 'off' | 'on'

type PushRegistration = {
  active: { scriptURL: string } | null
  pushManager: Pick<PushManager, 'getSubscription' | 'subscribe'>
}

/** What createPushController needs from the browser and the backend. */
export type PushEnvironment = {
  notification: { permission: NotificationPermission; requestPermission: () => Promise<NotificationPermission> } | undefined
  serviceWorker:
    | {
        register: (url: string, options: RegistrationOptions) => Promise<unknown>
        getRegistration: () => Promise<PushRegistration | undefined>
        ready: () => Promise<PushRegistration>
        /** The script of the worker controlling this page, if any. */
        controllerScript: () => string | undefined
      }
    | undefined
  /** `'PushManager' in window`. */
  pushSupported: boolean
  /** Opened from the Home Screen (display-mode: standalone). */
  standalone: boolean
  /** An iPhone or iPad, whatever the browser says it is. */
  appleMobile: boolean
  api: {
    getPublicKey: () => Promise<string>
    save: (subscription: PushSubscriptionRequest) => Promise<number>
    remove: (id: number) => Promise<void>
  }
}

export type PushController = {
  status: () => Promise<PushStatus>
  /** Asks the browser, subscribes, and saves it. Call it straight from a click. */
  enable: () => Promise<PushStatus>
  /** Stops sending to this device, and unsubscribes it. */
  disable: () => Promise<PushStatus>
}

export type PushControllerOptions = {
  /** Where pwa() serves the worker. Default `/push-sw.js`. */
  serviceWorkerUrl?: string
}

const isMockWorker = (script: string | undefined) => !!script && script.includes('mockServiceWorker')

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function sameKey(current: ArrayBuffer | null | undefined, wanted: Uint8Array): boolean {
  if (!current) return false
  const bytes = new Uint8Array(current)
  return bytes.length === wanted.length && bytes.every((byte, i) => byte === wanted[i])
}

function toRequest(subscription: PushSubscription): PushSubscriptionRequest {
  const json = subscription.toJSON()
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!json.endpoint || !p256dh || !auth) throw new Error('The browser gave a subscription without its keys.')
  return { endpoint: json.endpoint, expirationTime: json.expirationTime ?? null, keys: { p256dh, auth } }
}

export function createPushController(env: PushEnvironment, options: PushControllerOptions = {}): PushController {
  const workerUrl = options.serviceWorkerUrl ?? '/push-sw.js'

  // What can be told without waiting on anything, so enable() can ask
  // the browser in the same task as the click.
  const knownNow = (): PushStatus | null => {
    if (env.appleMobile && !env.standalone) return 'needs-install'
    if (!env.notification || !env.serviceWorker || !env.pushSupported) return 'unsupported'
    if (isMockWorker(env.serviceWorker.controllerScript())) return 'mock'
    if (env.notification.permission === 'denied') return 'blocked'
    return null
  }

  const ours = (registration: PushRegistration | undefined) =>
    registration?.active && !isMockWorker(registration.active.scriptURL) ? registration : undefined

  return {
    async status() {
      const known = knownNow()
      if (known) return known
      const registration = await env.serviceWorker!.getRegistration()
      if (isMockWorker(registration?.active?.scriptURL)) return 'mock'
      if (env.notification!.permission !== 'granted') return 'off'
      const subscription = await ours(registration)?.pushManager.getSubscription()
      return subscription ? 'on' : 'off'
    },

    async enable() {
      const known = knownNow()
      if (known) return known
      const permission = await env.notification!.requestPermission()
      if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off'
      await env.serviceWorker!.register(workerUrl, { scope: '/' })
      const registration = await env.serviceWorker!.ready()
      const key = base64UrlToBytes(await env.api.getPublicKey())
      let subscription = await registration.pushManager.getSubscription()
      // Made with another key (the backend's was replaced): it can't be
      // sent to any more, so start again.
      if (subscription && !sameKey(subscription.options.applicationServerKey, key)) {
        await subscription.unsubscribe()
        subscription = null
      }
      subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
      await env.api.save(toRequest(subscription))
      return 'on'
    },

    async disable() {
      const subscription = await ours(await env.serviceWorker?.getRegistration())?.pushManager.getSubscription()
      if (subscription) {
        // Saving again is how the device learns its id (the same endpoint
        // answers the same one), so nothing is kept on the device.
        const id = await env.api.save(toRequest(subscription))
        await env.api.remove(id)
        await subscription.unsubscribe()
      }
      return 'off'
    },
  }
}

function browserEnvironment(): PushEnvironment {
  const hasWindow = typeof window !== 'undefined'
  const container = hasWindow && 'serviceWorker' in navigator ? navigator.serviceWorker : undefined
  const ua = hasWindow ? navigator.userAgent : ''
  return {
    notification: hasWindow && 'Notification' in window ? Notification : undefined,
    serviceWorker: container && {
      register: (url, options) => container.register(url, options),
      getRegistration: () => container.getRegistration(),
      ready: () => container.ready,
      controllerScript: () => container.controller?.scriptURL,
    },
    pushSupported: hasWindow && 'PushManager' in window,
    standalone:
      hasWindow &&
      (window.matchMedia?.('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true),
    // iPadOS says it's a Mac; a Mac has no touch screen.
    appleMobile: /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && hasWindow && navigator.maxTouchPoints > 1),
    api: { getPublicKey: getPushPublicKey, save: savePushSubscription, remove: deletePushSubscription },
  }
}

function messageOf(error: unknown): string {
  const appError = error as Partial<AppError> | null
  if (appError && typeof appError.kind === 'string') {
    if (appError.kind === 'notfound') return "This app's backend doesn't send reminders yet."
    if (appError.kind === 'network') return "Couldn't reach the app. Check the connection and try again."
    return appError.message ?? 'Something went wrong. Try again.'
  }
  return "The browser couldn't turn on reminders. Try again, or check its notification settings."
}

export const PUSH_STATUS_QUERY_KEY = ['ui-foundation', 'push-status'] as const

/** What usePushPermission returns, and what AllowReminders shows. */
export type PushPermission = {
  /** Undefined while it's being worked out. */
  status: PushStatus | undefined
  enable: () => void
  disable: () => void
  /** Turning on or off is under way. */
  pending: boolean
  /** Why the last enable or disable failed, in words to show. */
  error: string | null
}

/**
 * Whether this device gets reminders, and `enable`/`disable` for one
 * button (AllowReminders is that button, with the words around it).
 * `enable` asks the browser for permission: only ever call it from a click.
 */
export function usePushPermission(options: PushControllerOptions = {}): PushPermission {
  const queryClient = useQueryClient()
  const controller = createPushController(browserEnvironment(), options)
  const { data: status } = useQuery({
    queryKey: PUSH_STATUS_QUERY_KEY,
    queryFn: () => controller.status(),
    staleTime: Infinity,
  })
  const settle = (next: PushStatus) => queryClient.setQueryData(PUSH_STATUS_QUERY_KEY, next)
  // Each takes the run already started: enable() must ask the browser in
  // the click itself, and mutate() may call its function a tick later.
  const enable = useMutation({ mutationFn: (run: Promise<PushStatus>) => run, onSuccess: settle })
  const disable = useMutation({ mutationFn: (run: Promise<PushStatus>) => run, onSuccess: settle })
  const failed = enable.error ?? disable.error
  return {
    status,
    enable: () => {
      disable.reset()
      enable.mutate(controller.enable())
    },
    disable: () => {
      enable.reset()
      disable.mutate(controller.disable())
    },
    pending: enable.isPending || disable.isPending,
    error: failed ? messageOf(failed) : null,
  }
}
