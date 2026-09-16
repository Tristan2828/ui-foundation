// Exposes the running MSW worker, plus the handler-building functions, on
// `window` so Playwright specs can force loading/empty/error/validation
// states via worker.use(...) — see docs/BUILD-PLAN.md Phase 4 step 5
// ("forcing each state through MSW handler overrides") and
// e2e/widgets-table.spec.ts / e2e/widget-form.spec.ts.
//
// Only ever wired when MSW mocking itself is active (src/main.tsx checks
// VITE_API !== 'real' first) — there is no real backend or real data behind
// this in that mode, so there is nothing sensitive to expose.
import { http, HttpResponse, delay } from "msw";
import { worker } from "./browser";

type OverrideSpec = {
  method: "get" | "post" | "patch" | "delete";
  path: string;
  status?: number;
  body?: unknown;
  delayMs?: number;
};

declare global {
  interface Window {
    __msw: {
      worker: typeof worker;
      http: typeof http;
      HttpResponse: typeof HttpResponse;
      delay: typeof delay;
    };
    // Set via page.addInitScript before a forced-first-load test navigates —
    // ordinary post-navigation `worker.use()` (via window.__msw) can't win a
    // race against the app's own first fetch, which may already be in
    // flight by the time a Playwright `page.evaluate` call runs.
    __E2E_MSW_OVERRIDE__?: OverrideSpec;
  }
}

export function exposeMswForE2E(): void {
  window.__msw = { worker, http, HttpResponse, delay };

  const override = window.__E2E_MSW_OVERRIDE__;
  if (override) {
    worker.use(
      http[override.method](override.path, async () => {
        if (override.delayMs) await delay(override.delayMs);
        return HttpResponse.json(override.body ?? {}, { status: override.status ?? 200 });
      }),
    );
  }
}
