// The package's own lint: the same token and fetch rules apps get
// (./eslint/index.js), with the package's internal boundaries in place of
// an app's. Inside the package, transport/ is the one fetch caller and only
// the gateway modules may import it; auth internals stay behind use-auth.
import tanstackQuery from '@tanstack/eslint-plugin-query'
import { defineConfig, globalIgnores } from 'eslint/config'
import { baseConfig, kebabCaseFilenames, NO_BARE_FETCH, TOKEN_SYNTAX_RULES } from './eslint/index.js'

const INTERNAL_BOUNDARIES = [
  {
    group: ['**/transport', '**/transport/*', '**/api/transport', '**/api/transport/*'],
    message: 'Only src/api/gateway/ may call transport/.',
  },
  {
    group: ['**/auth-provider', '**/auth/auth-provider'],
    message: 'Import from src/auth/use-auth instead — auth-provider.tsx is the only file that knows how auth works.',
  },
]

export default defineConfig([
  globalIgnores(['dist', 'storybook-static', 'test-results', '.claude/worktrees']),
  {
    ...baseConfig(),
    rules: {
      'no-restricted-syntax': ['error', ...TOKEN_SYNTAX_RULES, NO_BARE_FETCH],
      'no-restricted-imports': ['error', { patterns: INTERNAL_BOUNDARIES }],
    },
  },
  {
    // shadcn-generated primitives: shadcn's convention exports a component
    // alongside its `*Variants` helper — a false positive for fast-refresh.
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // The gateway (and its public entry point) is the one permitted caller of transport/.
    files: ['src/api/gateway/**/*.ts', 'src/gateway.ts', 'src/auth/**/*.{ts,tsx}', 'src/index.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // transport/ is the one place a bare fetch call is expected.
    files: ['src/api/transport/**/*.ts'],
    rules: { 'no-restricted-syntax': ['error', ...TOKEN_SYNTAX_RULES], 'no-restricted-imports': 'off' },
  },
  {
    // Barrels and the Playwright helpers re-export or register, they don't render.
    files: ['src/index.ts', 'src/testing/**/*.ts', 'src/components/app/foundation-providers.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  kebabCaseFilenames(['src/**/*.{ts,tsx}', 'tests/**/*.ts', 'e2e/**/*.ts'], ['src/components/ui/**']),
  {
    files: ['tests/**/*.{ts,tsx}', 'e2e/**/*.{ts,tsx}'],
    rules: { 'no-restricted-syntax': ['error', ...TOKEN_SYNTAX_RULES] },
  },
  {
    // Node code: the build script, the CLI and the lint config itself.
    files: ['**/*.{js,mjs}'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
  },
  ...tanstackQuery.configs['flat/recommended'],
])
