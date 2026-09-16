// Node-side MSW server — used by the mock-conformance tests and, later,
// by gateway/component tests that want a real (mocked) network round trip
// instead of a stubbed fetch.
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
