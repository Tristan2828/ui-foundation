// `@tristan2828/ui-foundation/eslint` — the lint half of the Hard Rules
// (AGENTS.md), shared so every app enforces the same ones and gets new ones
// by upgrading the package. An app's whole eslint.config.js:
//
//   import uiFoundation from '@tristan2828/ui-foundation/eslint'
//   export default uiFoundation()
//
// Plain JavaScript on purpose: ESLint loads this before any TypeScript
// tooling runs. The plugins are the app's own devDependencies (optional
// peer dependencies of the package).
import { readdirSync } from 'node:fs'
import js from '@eslint/js'
import tanstackQuery from '@tanstack/eslint-plugin-query'
import checkFile from 'eslint-plugin-check-file'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export const PACKAGE_NAME = '@tristan2828/ui-foundation'

// The primitives the package ships, read from what was built (dist/) or,
// inside this repo before a build, from source. An app importing one of
// these from its own src/components/ui/ has a second, unpatched copy —
// usually because `shadcn add` pulled it in as another primitive's
// dependency.
function shippedPrimitives() {
  for (const dir of ['../dist/components/ui', '../src/components/ui']) {
    try {
      return readdirSync(new URL(dir, import.meta.url))
        .filter((file) => /^[a-z0-9-]+\.(js|tsx)$/.test(file) && !file.includes('.stories.'))
        .map((file) => file.replace(/\.(js|tsx)$/, ''))
    } catch {
      // Not there — try the next location.
    }
  }
  return []
}
export const PRIMITIVES = shippedPrimitives()

// Raw Tailwind palette classes bypass the semantic token layer — this is
// what makes "dark mode looks right" a lint error instead of a visual
// surprise.
const TAILWIND_PALETTE_CLASS =
  '/\\b(bg|text|border|ring|fill|stroke)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\\d{2,3}\\b/'
const HEX_COLOR = '/#[0-9a-f]{3,8}/i'

export const TOKEN_SYNTAX_RULES = [
  {
    selector: `JSXAttribute[name.name='className'] Literal[value=${TAILWIND_PALETTE_CLASS}]`,
    message:
      'Use semantic tokens (bg-primary, text-muted-foreground, ...), not raw Tailwind palette classes. See the design-language doc.',
  },
  {
    selector: `JSXAttribute[name.name='style'] Property Literal[value=${HEX_COLOR}]`,
    message: 'No raw hex colors in style props. Use a semantic token.',
  },
]

export const NO_BARE_FETCH = {
  selector: "CallExpression[callee.name='fetch']",
  message:
    'Do not call fetch directly. All server state goes through TanStack Query, which calls src/api/gateway/, which builds on the foundation gateway entry point.',
}

// The rules every TypeScript file gets, before any boundary rule.
export function baseConfig() {
  return {
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
  }
}

export function kebabCaseFilenames(files, ignores = []) {
  return {
    files,
    ignores,
    plugins: { 'check-file': checkFile },
    rules: {
      'check-file/filename-naming-convention': [
        'error',
        { '**/*.{ts,tsx}': 'KEBAB_CASE' },
        { ignoreMiddleExtensions: true },
      ],
    },
  }
}

const GATEWAY_ONLY = {
  group: [`${PACKAGE_NAME}/gateway`],
  message:
    'Only src/api/gateway/ may import the foundation gateway entry point. Components and hooks call a gateway module through TanStack Query.',
}

const PACKAGE_INTERNALS = {
  group: [`${PACKAGE_NAME}/dist/*`, `${PACKAGE_NAME}/src/*`],
  message: `Import from ${PACKAGE_NAME}'s public entry points only. Need something it doesn't export? Raise it for the foundation instead of reaching in.`,
}

function appImportPatterns({ allowGateway }) {
  const patterns = [PACKAGE_INTERNALS]
  if (!allowGateway) patterns.push(GATEWAY_ONLY)
  if (PRIMITIVES.length > 0) {
    patterns.push({
      regex: `^@/components/ui/(${PRIMITIVES.join('|')})$`,
      message: `The foundation ships this primitive: import it from ${PACKAGE_NAME}/ui/<name> and delete the app's copy (shadcn add re-creates one when another primitive depends on it).`,
    })
  }
  return patterns
}

/**
 * The lint config for an app built on the foundation.
 * @param {{ ignores?: string[] }} [options] extra paths to ignore, on top of build output and generated files
 */
export default function uiFoundation(options = {}) {
  return defineConfig([
    // .claude/worktrees: a session running in a git worktree nested under
    // the project root is normal in an agent-built repo; without this, one
    // session's in-progress files fail another session's verify.
    globalIgnores([
      'dist',
      'storybook-static',
      'test-results',
      'playwright-report',
      'public/mockServiceWorker.js',
      '.claude/worktrees',
      'backend',
      ...(options.ignores ?? []),
    ]),
    {
      ...baseConfig(),
      rules: {
        'no-restricted-syntax': ['error', ...TOKEN_SYNTAX_RULES, NO_BARE_FETCH],
        'no-restricted-imports': ['error', { patterns: appImportPatterns({ allowGateway: false }) }],
      },
    },
    {
      // App-added shadcn primitives: CLI-installed, and shadcn's convention
      // exports a component alongside its `*Variants` helper from one file
      // — a false positive for fast-refresh.
      files: ['src/components/ui/**/*.{ts,tsx}'],
      rules: { 'react-refresh/only-export-components': 'off' },
    },
    {
      // The gateway is the one layer allowed onto the network.
      files: ['src/api/gateway/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': ['error', { patterns: appImportPatterns({ allowGateway: true }) }],
      },
    },
    // Kebab-case for everything hand-authored. App.tsx and main.tsx are
    // Vite's own scaffold names; src/components/ui/ is shadcn's.
    kebabCaseFilenames(['src/**/*.{ts,tsx}', 'e2e/**/*.ts', 'tests/**/*.ts'], [
      'src/App.tsx',
      'src/main.tsx',
      'src/components/ui/**',
    ]),
    {
      // Tests exercise the HTTP boundary directly (gateway tests stub
      // fetch, conformance tests call it against MSW, e2e specs call it in
      // the page) — the no-bare-fetch rule keeps app code on the gateway,
      // not tests off the primitive they're testing.
      files: ['tests/**/*.{ts,tsx}', 'e2e/**/*.{ts,tsx}'],
      rules: { 'no-restricted-syntax': ['error', ...TOKEN_SYNTAX_RULES] },
    },
    ...tanstackQuery.configs['flat/recommended'],
  ])
}
