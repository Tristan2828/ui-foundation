// `@tristan2828/ui-foundation/vite`: build-info.json says which API the
// bundle calls, and the build args reach import.meta.env. The template's
// own build runs it for real (its backend's deploy check reads the file).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import buildInfo, { type BuildInfoOptions } from '../vite/index.js'

type Emitted = { type: string; fileName: string; source: string }

function run(env: Record<string, string>, options?: BuildInfoOptions) {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
  const plugin = buildInfo(options) as unknown as {
    apply: string
    config: () => { define: Record<string, string> }
    configResolved: (config: { env: Record<string, string>; root: string }) => void
    buildStart: () => void
    generateBundle: (this: { emitFile: (file: Emitted) => void }) => void
  }
  return {
    plugin,
    bundle(viteEnv: Record<string, string>, root = process.cwd()) {
      plugin.configResolved({ env: viteEnv, root })
      plugin.buildStart()
      const emitted: Emitted[] = []
      plugin.generateBundle.call({ emitFile: (file) => emitted.push(file) })
      expect(emitted).toHaveLength(1)
      expect(emitted[0].fileName).toBe('build-info.json')
      return JSON.parse(emitted[0].source) as Record<string, unknown>
    },
  }
}

const roots: string[] = []

/** A Vite root holding backend/migrations/versions with these migrations. */
function migrations(files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'build-info-'))
  roots.push(root)
  const dir = path.join(root, 'backend', 'migrations', 'versions')
  fs.mkdirSync(dir, { recursive: true })
  for (const [name, source] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), source)
  return root
}

// As the template's migrations are written.
const migration = (revision: string, down: string | null) =>
  `"""A migration."""\nrevision: str = "${revision}"\ndown_revision: Union[str, None] = ${down ? `"${down}"` : 'None'}\n`

afterEach(() => {
  vi.unstubAllEnvs()
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
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

  it('has no schema field without the alembic option', () => {
    expect(run({}).bundle({ VITE_API: 'real' })).not.toHaveProperty('schema')
  })
})

describe('buildInfo alembic', () => {
  const alembic = 'backend/migrations/versions'

  it('records the head revision, whatever order the files are in', () => {
    const root = migrations({
      '0002_b.py': migration('0002', '0001'),
      '0001_a.py': migration('0001', null),
      '0003_c.py': migration('0003', '0002'),
      '__init__.py': '',
      'README': 'not a migration',
    })
    expect(run({}, { alembic }).bundle({ VITE_API: 'real' }, root).schema).toBe('0003')
  })

  it("reads Alembic's untyped form and a merge revision over several lines", () => {
    const root = migrations({
      'a.py': "revision = 'a1'\ndown_revision = None\n",
      'b.py': "revision = 'b1'\ndown_revision = 'a1'\n",
      'c.py': "revision = 'c1'\ndown_revision = 'a1'\n",
      'merge.py': "revision = 'm1'\ndown_revision = (\n    'b1',\n    'c1',\n)\n",
    })
    expect(run({}, { alembic }).bundle({}, root).schema).toBe('m1')
  })

  it('fails the build on several heads, naming them', () => {
    const root = migrations({
      'a.py': migration('a1', null),
      'b.py': migration('b1', 'a1'),
      'c.py': migration('c1', 'a1'),
    })
    expect(() => run({}, { alembic }).bundle({}, root)).toThrow('several Alembic heads in')
    expect(() => run({}, { alembic }).bundle({}, root)).toThrow('(b1, c1)')
  })

  it('fails the build with no migrations, or no folder', () => {
    expect(() => run({}, { alembic }).bundle({}, migrations({}))).toThrow('no Alembic head in')
    expect(() => run({}, { alembic: 'nowhere' }).bundle({}, migrations({}))).toThrow('no Alembic versions folder at')
  })
})

describe('buildInfo extra', () => {
  it('merges its fields into the file', () => {
    const info = run({ BUILD_COMMIT: 'abc1234' }, { extra: () => ({ region: 'eu', image: { tag: 'v3' } }) }).bundle({
      VITE_API: 'real',
    })
    expect(info).toMatchObject({ api: 'real', commit: 'abc1234', region: 'eu', image: { tag: 'v3' } })
  })

  it("can't replace the plugin's own fields, so a mock build can't claim real", () => {
    const { bundle } = run({}, { extra: () => ({ api: 'real', schema: 'x' }) })
    expect(() => bundle({})).toThrow("extra can't set api, schema")
  })
})
