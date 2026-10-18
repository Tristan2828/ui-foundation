// `@tristan2828/ui-foundation/vite`: build-info.json says which API the
// bundle calls, and the build args reach import.meta.env. The template's
// own build runs it for real (its backend's deploy check reads the file).
import { afterEach, describe, expect, it, vi } from 'vitest'
import buildInfo from '../vite/index.js'

type Emitted = { type: string; fileName: string; source: string }

function run(env: Record<string, string>, options?: { repoUrl?: string }) {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
  const plugin = buildInfo(options) as unknown as {
    apply: string
    config: () => { define: Record<string, string> }
    configResolved: (config: { env: Record<string, string> }) => void
    generateBundle: (this: { emitFile: (file: Emitted) => void }) => void
  }
  return {
    plugin,
    bundle(viteEnv: Record<string, string>) {
      plugin.configResolved({ env: viteEnv })
      const emitted: Emitted[] = []
      plugin.generateBundle.call({ emitFile: (file) => emitted.push(file) })
      expect(emitted).toHaveLength(1)
      expect(emitted[0].fileName).toBe('build-info.json')
      return JSON.parse(emitted[0].source) as Record<string, unknown>
    },
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('buildInfo', () => {
  it('runs on build only', () => {
    expect(run({}).plugin.apply).toBe('build')
  })

  it('says "real" only for a VITE_API=real build; anything else ships MSW', () => {
    const { bundle } = run({})
    expect(bundle({ VITE_API: 'real' }).api).toBe('real')
    expect(bundle({}).api).toBe('mock')
    expect(bundle({ VITE_API: 'mock' }).api).toBe('mock')
  })

  it('records the commit and PR from the build args', () => {
    const { bundle } = run({ BUILD_COMMIT: 'abc1234def', BUILD_PR: '12' })
    expect(bundle({ VITE_API: 'real' })).toMatchObject({ commit: 'abc1234def', pr: '12' })
  })

  it('records null for build args that are missing or blank', () => {
    const { bundle } = run({ BUILD_COMMIT: ' ', BUILD_PR: '' })
    expect(bundle({ VITE_API: 'real' })).toMatchObject({ commit: null, pr: null })
  })

  it('defines the import.meta.env values, BUILD_REPO_URL over the option', () => {
    const fromOption = run({ BUILD_COMMIT: 'abc1234' }, { repoUrl: 'https://github.com/me/app' }).plugin.config().define
    expect(fromOption).toEqual({
      'import.meta.env.VITE_BUILD_COMMIT': '"abc1234"',
      'import.meta.env.VITE_BUILD_PR': '""',
      'import.meta.env.VITE_BUILD_REPO_URL': '"https://github.com/me/app"',
    })
    const fromEnv = run({ BUILD_REPO_URL: 'https://github.com/me/fork' }, { repoUrl: 'https://github.com/me/app' })
    expect(fromEnv.plugin.config().define['import.meta.env.VITE_BUILD_REPO_URL']).toBe('"https://github.com/me/fork"')
  })
})
