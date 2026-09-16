import js from '@eslint/js'
import globals from 'globals'
import checkFile from 'eslint-plugin-check-file'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tanstackQuery from '@tanstack/eslint-plugin-query'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Raw Tailwind palette classes bypass the semantic token layer — see
// src/styles/theme.css and docs/BUILD-PLAN.md Phase 5. This is what makes
// "dark mode looks right" a lint error instead of a visual surprise.
const TAILWIND_PALETTE_CLASS =
  '/\\b(bg|text|border|ring|fill|stroke)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\\d{2,3}\\b/'
const HEX_COLOR = '/#[0-9a-f]{3,8}/i'

export default defineConfig([
  globalIgnores(['dist', 'public/mockServiceWorker.js']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: `JSXAttribute[name.name='className'] Literal[value=${TAILWIND_PALETTE_CLASS}]`,
          message:
            'Use semantic tokens (bg-primary, text-muted-foreground, ...), not raw Tailwind palette classes. See src/styles/theme.css.',
        },
        {
          selector: `JSXAttribute[name.name='style'] Property Literal[value=${HEX_COLOR}]`,
          message:
            'No raw hex colors in style props. Use a semantic token from src/styles/theme.css.',
        },
        {
          selector: "CallExpression[callee.name='fetch']",
          message:
            'Do not call fetch directly. All server state goes through TanStack Query, which calls src/api/gateway/, which is the only caller of src/api/transport/.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/transport', '**/transport/*', '**/api/transport', '**/api/transport/*'],
              message: 'Import from src/api/gateway/ instead — only the gateway may call transport/.',
            },
            {
              group: ['**/auth-provider', '**/auth/auth-provider'],
              message: 'Import useAuth from src/auth/use-auth instead — auth-provider.tsx is the only file that knows how auth works.',
            },
          ],
        },
      ],
    },
  },
  {
    // shadcn-generated primitives: CLI-installed, not hand-edited pages, and
    // shadcn's own convention exports a component alongside its `*Variants`
    // helper from the same file — a false positive for fast-refresh.
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // The gateway is the one permitted caller of transport/ — the anti-
    // corruption layer boundary this rule exists to enforce (see
    // docs/BUILD-PLAN.md "Anti-Corruption Layer").
    files: ['src/api/gateway/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    // transport/ is the one place a bare fetch call, or an import of itself,
    // is expected.
    files: ['src/api/transport/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': 'off',
      'no-restricted-imports': 'off',
    },
  },
  {
    // src/auth/ is the boundary itself — its own files may reference
    // auth-provider.tsx directly.
    files: ['src/auth/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    // Phase 4: shadcn's own files are kebab-case; enforce the same
    // convention on everything we hand-author so the agent doesn't pick a
    // different one per session (docs/BUILD-PLAN.md Phase 4 note). Scoped
    // to hand-authored directories — src/App.tsx and src/main.tsx are
    // Vite's own scaffold naming from Phase 1 and predate this rule, and
    // src/components/ui/** is CLI-owned (already its own kebab-case
    // convention, governed by the registry, not this rule).
    files: [
      'src/routes/**/*.{ts,tsx}',
      'src/components/app/**/*.{ts,tsx}',
      'src/api/**/*.{ts,tsx}',
      'src/auth/**/*.{ts,tsx}',
      'src/mocks/**/*.{ts,tsx}',
      'src/hooks/**/*.{ts,tsx}',
      'src/lib/**/*.{ts,tsx}',
      'e2e/**/*.ts',
      'tests/**/*.ts',
    ],
    plugins: { 'check-file': checkFile },
    rules: {
      'check-file/filename-naming-convention': [
        'error',
        { '**/*.{ts,tsx}': 'KEBAB_CASE' },
        { ignoreMiddleExtensions: true },
      ],
    },
  },
  {
    // Tests exercise the HTTP boundary directly (gateway tests stub fetch;
    // mock-conformance tests call it against the real MSW handlers; e2e
    // specs call it from inside the browser page via page.evaluate) — the
    // no-bare-fetch rule exists to keep app code on the gateway, not to
    // keep tests off the network primitive they're testing.
    files: ['tests/**/*.{ts,tsx}', 'e2e/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  ...tanstackQuery.configs['flat/recommended'],
])
