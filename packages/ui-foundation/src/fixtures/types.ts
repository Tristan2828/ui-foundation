import type { ComponentProps, ComponentType, ReactElement } from 'react'

// The shape of a `*.fixtures.tsx` file: a default export (`Meta`) naming the
// component, and named exports (`StoryObj`), each one state of it. The test
// harness (e2e/harness/) renders one state by id and lists them all on its
// index page. Not shipped: tsconfig.build.json leaves out src/fixtures.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Anything = any

/** Props of a component, or the args type itself when it isn't one. */
type ArgsOf<T> = T extends ComponentType<Anything> ? ComponentProps<T> : T

export type Decorator = (Story: ComponentType, context: { args: Anything }) => ReactElement

export type Parameters = {
  /** `fullscreen` drops the harness's own padding around the state. */
  layout?: 'padded' | 'fullscreen'
  [key: string]: unknown
}

export type Meta<T = Anything> = {
  /** `Group/Name`; with an export's name it makes the state's id. */
  title: string
  component?: ComponentType<Anything>
  args?: Partial<ArgsOf<T>>
  /** Kept for the editor's sake: the harness has no controls panel. */
  argTypes?: Record<string, unknown>
  parameters?: Parameters
  decorators?: Decorator[]
  render?: (args: ArgsOf<T>) => ReactElement
}

export type StoryObj<T = Anything> = {
  /** The name the index page shows; the id comes from the export's name. */
  name?: string
  argTypes?: Record<string, unknown>
  args?: Partial<ArgsOf<T>>
  parameters?: Parameters
  decorators?: Decorator[]
  render?: (args: ArgsOf<T>) => ReactElement
}
