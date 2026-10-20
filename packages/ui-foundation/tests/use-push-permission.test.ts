// usePushPermission's rules (src/hooks/use-push-permission.ts) against a
// fake browser and backend: what each device and permission reads as, that
// enable() asks the browser before anything else, subscribes with the
// backend's key and saves it, replaces a subscription made with another
// key, and that disable() drops it on both sides.
import { describe, expect, it } from 'vitest'
import { createPushController, type PushEnvironment } from '../src/hooks/use-push-permission'

const KEY = 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8'
const OTHER_KEY = 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4'

const bytes = (key: string) => Uint8Array.from(atob(key.replace(/-/g, '+').replace(/_/g, '/') + '='), (c) => c.charCodeAt(0))

class FakeSubscription {
  unsubscribed = false
  constructor(
    readonly endpoint: string,
    key: string,
  ) {
    this.options = { applicationServerKey: bytes(key).buffer, userVisibleOnly: true }
  }
  options: PushSubscriptionOptions
  toJSON(): PushSubscriptionJSON {
    return { endpoint: this.endpoint, expirationTime: null, keys: { p256dh: 'p256dh-key', auth: 'auth-key' } }
  }
  unsubscribe() {
    this.unsubscribed = true
    return Promise.resolve(true)
  }
}

function fake(overrides: Partial<Omit<PushEnvironment, 'api'>> = {}, permission: NotificationPermission = 'default') {
  const log: string[] = []
  let subscription: FakeSubscription | null = null
  let registered: string | undefined
  let answer: NotificationPermission = 'granted'
  const notification = {
    permission,
    requestPermission: () => {
      log.push('ask')
      notification.permission = answer
      return Promise.resolve(answer)
    },
  }
  const registration = {
    get active() {
      return registered ? { scriptURL: `https://app.example${registered}` } : null
    },
    pushManager: {
      getSubscription: () => Promise.resolve(subscription as unknown as PushSubscription | null),
      subscribe: (options?: PushSubscriptionOptionsInit) => {
        const key = btoa(String.fromCharCode(...(options!.applicationServerKey as Uint8Array)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '')
        log.push(`subscribe ${key === KEY ? 'KEY' : key}`)
        subscription = new FakeSubscription(`https://fcm.googleapis.com/fcm/send/${log.length}`, key)
        return Promise.resolve(subscription as unknown as PushSubscription)
      },
    },
  }
  const saved = new Map<string, number>()
  const env: PushEnvironment = {
    notification,
    serviceWorker: {
      register: (url) => {
        log.push(`register ${url}`)
        registered = url
        return Promise.resolve(registration)
      },
      getRegistration: () => Promise.resolve(registered ? registration : undefined),
      ready: () => Promise.resolve(registration),
      controllerScript: () => undefined,
    },
    pushSupported: true,
    standalone: false,
    appleMobile: false,
    api: {
      getPublicKey: () => {
        log.push('key')
        return Promise.resolve(KEY)
      },
      save: (request) => {
        const id = saved.get(request.endpoint) ?? saved.size + 1
        saved.set(request.endpoint, id)
        log.push(`save ${id}`)
        return Promise.resolve(id)
      },
      remove: (id) => {
        log.push(`remove ${id}`)
        return Promise.resolve()
      },
    },
    ...overrides,
  }
  return {
    env,
    log,
    current: () => subscription,
    subscribeWith(key: string) {
      registered = '/push-sw.js'
      subscription = new FakeSubscription('https://fcm.googleapis.com/fcm/send/old', key)
      return subscription
    },
    answer: (next: NotificationPermission) => {
      answer = next
    },
  }
}

describe('createPushController', () => {
  it('reads an iPhone in a browser tab as needs-install, and on the Home Screen as off', async () => {
    expect(await createPushController(fake({ appleMobile: true }).env).status()).toBe('needs-install')
    expect(await createPushController(fake({ appleMobile: true, standalone: true }).env).status()).toBe('off')
  })

  it('reads a browser without push as unsupported', async () => {
    expect(await createPushController(fake({ pushSupported: false }).env).status()).toBe('unsupported')
    expect(await createPushController(fake({ notification: undefined }).env).status()).toBe('unsupported')
  })

  it('reads a page under MSW as mock, and never asks or registers there', async () => {
    const browser = fake()
    browser.env.serviceWorker!.controllerScript = () => 'https://app.example/mockServiceWorker.js'
    const push = createPushController(browser.env)
    expect(await push.status()).toBe('mock')
    expect(await push.enable()).toBe('mock')
    expect(browser.log).toEqual([])
  })

  it('reads a refusal as blocked, and never asks again', async () => {
    const browser = fake({}, 'denied')
    const push = createPushController(browser.env)
    expect(await push.status()).toBe('blocked')
    expect(await push.enable()).toBe('blocked')
    expect(browser.log).toEqual([])
  })

  it('asks before anything else, then registers, subscribes with the backend key and saves it', async () => {
    const browser = fake()
    const push = createPushController(browser.env)
    expect(await push.status()).toBe('off')
    const pending = push.enable()
    // Asked in the same task as the click, before any await.
    expect(browser.log).toEqual(['ask'])
    expect(await pending).toBe('on')
    expect(browser.log).toEqual(['ask', 'register /push-sw.js', 'key', 'subscribe KEY', 'save 1'])
    expect(await push.status()).toBe('on')
  })

  it('stays off when the person dismisses the prompt, and blocked when they refuse', async () => {
    const browser = fake()
    browser.answer('default')
    expect(await createPushController(browser.env).enable()).toBe('off')
    browser.answer('denied')
    expect(await createPushController(browser.env).enable()).toBe('blocked')
    expect(browser.log).toEqual(['ask', 'ask'])
  })

  it('keeps a subscription made with the same key, and replaces one made with another', async () => {
    const same = fake({}, 'granted')
    same.subscribeWith(KEY)
    expect(await createPushController(same.env).enable()).toBe('on')
    expect(same.log).toEqual(['ask', 'register /push-sw.js', 'key', 'save 1'])

    const other = fake({}, 'granted')
    const old = other.subscribeWith(OTHER_KEY)
    expect(await createPushController(other.env).enable()).toBe('on')
    expect(old.unsubscribed).toBe(true)
    expect(other.log).toContain('subscribe KEY')
  })

  it('turns off on both sides: the backend forgets the device, the browser unsubscribes', async () => {
    const browser = fake({}, 'granted')
    const push = createPushController(browser.env, { serviceWorkerUrl: '/sw/push.js' })
    await push.enable()
    const subscription = browser.current()!
    expect(await push.disable()).toBe('off')
    expect(browser.log.slice(-2)).toEqual(['save 1', 'remove 1'])
    expect(subscription.unsubscribed).toBe(true)
    expect(browser.log).toContain('register /sw/push.js')
  })

  it('turning off a device that was never on does nothing', async () => {
    const browser = fake({}, 'granted')
    expect(await createPushController(browser.env).disable()).toBe('off')
    expect(browser.log).toEqual([])
  })
})
