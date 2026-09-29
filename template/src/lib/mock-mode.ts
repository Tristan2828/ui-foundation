// Whether the app is serving the API from MSW rather than a real backend.
// VITE_API is baked in at build time, so this is a constant, not a runtime
// check — a plain `npm run build` produces a mock-mode bundle.
//
// Shared so main.tsx's mocking switch and the banner that announces it can
// never disagree about which mode is in effect.
export const IS_MOCK_MODE = import.meta.env.VITE_API !== 'real'
