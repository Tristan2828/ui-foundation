import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Raw Tailwind palette classes bypass the semantic token layer — see
// src/styles/theme.css and docs/BUILD-PLAN.md Phase 5. This is what makes
// "dark mode looks right" a lint error instead of a visual surprise.
const TAILWIND_PALETTE_CLASS =
  '/\\b(bg|text|border|ring|fill|stroke)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\\d{2,3}\\b/'
const HEX_COLOR = '/#[0-9a-f]{3,8}/i'

export default defineConfig([
  globalIgnores(['dist']),
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
])
