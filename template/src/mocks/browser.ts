// Registers the MSW service worker in the browser. Only started in dev —
// see src/main.tsx. This is what lets the app run with no backend process.
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
