import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { load as loadYaml } from 'js-yaml'
import { afterEach, describe, expect, it } from 'vitest'

// `ui-foundation check-contract`, run the way an app runs it: from the app's
// root, against its openapi.yaml. JSON is valid YAML, so the app specs here
// are the foundation's own spec with parts taken out.
const PACKAGE_ROOT = path.resolve(import.meta.dirname, '..')
const BIN = path.join(PACKAGE_ROOT, 'bin/ui-foundation.mjs')
type Spec = {
  paths: Record<string, unknown>
  components: { schemas: Record<string, unknown> } & Record<string, Record<string, unknown>>
}
const foundation = () =>
  loadYaml(readFileSync(path.join(PACKAGE_ROOT, 'openapi/foundation.yaml'), 'utf8')) as Spec

let appRoot: string | undefined
afterEach(() => {
  if (appRoot) rmSync(appRoot, { recursive: true, force: true })
  appRoot = undefined
})

function checkContract(spec: Spec) {
  appRoot = mkdtempSync(path.join(tmpdir(), 'check-contract-'))
  writeFileSync(path.join(appRoot, 'openapi.yaml'), JSON.stringify(spec))
  const result = spawnSync(process.execPath, [BIN, 'check-contract'], { cwd: appRoot, encoding: 'utf8' })
  return { status: result.status, output: result.stdout + result.stderr }
}

describe('check-contract', () => {
  it('passes the foundation contract unchanged', () => {
    expect(checkContract(foundation()).status).toBe(0)
  })

  it('passes an app without sign-up: no /auth/register and no RegisterRequest', () => {
    const spec = foundation()
    delete spec.paths['/auth/register']
    delete spec.components.schemas.RegisterRequest
    const result = checkContract(spec)
    expect(result.output).not.toContain('RegisterRequest')
    expect(result.status).toBe(0)
  })

  it('requires RegisterRequest when the app has /auth/register', () => {
    const spec = foundation()
    delete spec.components.schemas.RegisterRequest
    const result = checkContract(spec)
    expect(result.status).toBe(1)
    expect(result.output).toContain('missing components.schemas.RegisterRequest')
  })

  it('still requires what a required path reaches, even when an optional path uses it too', () => {
    const spec = foundation()
    delete spec.paths['/auth/register']
    // RegisterRequest refs into LoginRequest and User, but /auth/login needs both.
    delete spec.components.schemas.LoginRequest
    delete spec.components.schemas.User
    const result = checkContract(spec)
    expect(result.status).toBe(1)
    expect(result.output).toContain('missing components.schemas.LoginRequest')
    expect(result.output).toContain('missing components.schemas.User')
  })

  // Every app before 3.19 has neither: the banner's path is additive.
  it('passes an app without the data-environment banner: no /environment and no DataEnvironment', () => {
    const spec = foundation()
    delete spec.paths['/environment']
    delete spec.components.schemas.DataEnvironment
    const result = checkContract(spec)
    expect(result.output).not.toContain('DataEnvironment')
    expect(result.status).toBe(0)
  })

  it('fails a /environment whose shape differs', () => {
    const spec = foundation()
    const schema = spec.components.schemas.DataEnvironment as { properties: Record<string, unknown> }
    schema.properties = { label: { type: 'string' } }
    const result = checkContract(spec)
    expect(result.status).toBe(1)
    expect(result.output).toContain('components.schemas.DataEnvironment differs')
  })

  it('fails a required path left out', () => {
    const spec = foundation()
    delete spec.paths['/auth/login']
    const result = checkContract(spec)
    expect(result.status).toBe(1)
    expect(result.output).toContain('missing path /auth/login')
  })
})
