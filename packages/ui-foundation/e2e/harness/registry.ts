import type { ComponentType } from 'react'
import { createElement } from 'react'
import type { Decorator, Meta, Parameters, StoryObj } from '@/fixtures/types'

export type Fixture = {
  id: string
  title: string
  name: string
  fullscreen: boolean
  Component: ComponentType
}

const modules = import.meta.glob<Record<string, unknown>>('../../src/**/*.fixtures.tsx', { eager: true })

// The words of an export name: `WithLogoRail` -> `With Logo Rail`,
// `Step2` -> `Step 2`.
function words(text: string) {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-zA-Z])([0-9])/g, '$1 $2')
    .replace(/([0-9])([a-zA-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

function build(meta: Meta, exportName: string, story: StoryObj): Fixture {
  const id = words(exportName)
  const name = story.name ?? id
  const args = { ...meta.args, ...story.args }
  const parameters: Parameters = { ...meta.parameters, ...story.parameters }
  const render = story.render ?? meta.render
  const Plain: ComponentType = () =>
    render ? render(args) : meta.component ? createElement(meta.component, args) : null
  // The state's decorators sit inside the meta's.
  const decorators: Decorator[] = [...(story.decorators ?? []), ...(meta.decorators ?? [])]
  const Component = decorators.reduce<ComponentType>((Inner, decorator) => {
    const Wrapped: ComponentType = () => decorator(Inner, { args })
    return Wrapped
  }, Plain)
  return {
    id: `${slug(meta.title)}--${slug(id)}`,
    title: meta.title,
    name,
    fullscreen: parameters.layout === 'fullscreen',
    Component,
  }
}

export const fixtures: Fixture[] = Object.entries(modules)
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([, module]) => {
    const meta = module.default as Meta
    return Object.entries(module)
      .filter(([key]) => key !== 'default')
      .map(([key, story]) => build(meta, key, story as StoryObj))
  })
