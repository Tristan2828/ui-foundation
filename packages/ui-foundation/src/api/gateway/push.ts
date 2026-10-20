// Anti-corruption layer for /push/* (openapi/foundation.yaml, x-optional):
// the app's VAPID public key, and saving or dropping this device's push
// subscription. Only usePushPermission calls these.
import type { components } from "../schema";
import { safeFetch, toAppError } from "./errors";

type PushPublicKey = components["schemas"]["PushPublicKey"];
type PushSubscriptionCreated = components["schemas"]["PushSubscriptionCreated"];
export type PushSubscriptionRequest = components["schemas"]["PushSubscriptionRequest"];

/** The key to subscribe with. A 404 is a backend with push turned off. */
export async function getPushPublicKey(): Promise<string> {
  const res = await safeFetch("/push/public-key");
  if (res.status !== 200) throw toAppError(res.status, res.body, res.headers);
  return (res.body as PushPublicKey).publicKey;
}

/** Saves the subscription; the same device again answers the same id. */
export async function savePushSubscription(subscription: PushSubscriptionRequest): Promise<number> {
  const res = await safeFetch("/push/subscriptions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(subscription),
  });
  if (res.status !== 201) throw toAppError(res.status, res.body, res.headers);
  return (res.body as PushSubscriptionCreated).id;
}

/** Already gone (404) counts as done. */
export async function deletePushSubscription(id: number): Promise<void> {
  const res = await safeFetch(`/push/subscriptions/${id}`, { method: "DELETE" });
  if (res.status !== 204 && res.status !== 404) throw toAppError(res.status, res.body, res.headers);
}
