// Ambient shape of the window hooks src/mocks/e2e-hooks.ts installs in the
// browser page. Declared separately here (not imported from src/) so this
// test suite — a distinct TS project, see tsconfig.test.json — never pulls
// in application source, only the msw package types it already depends on.
export {};

declare global {
  interface Window {
    __msw: {
      worker: import("msw/browser").SetupWorker;
      http: typeof import("msw").http;
      HttpResponse: typeof import("msw").HttpResponse;
      delay: typeof import("msw").delay;
    };
    __E2E_MSW_OVERRIDE__?: {
      method: "get" | "post" | "patch" | "delete";
      path: string;
      status?: number;
      body?: unknown;
      delayMs?: number;
    };
  }
}
