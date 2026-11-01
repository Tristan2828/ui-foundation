import { createRoot } from 'react-dom/client'
import './harness.css'
import { fixtures } from './registry'
import { setGlobals } from './set-globals'

// One fixture by id: `story.html?id=app-board--default&theme=dark&density=large`.
// The specs open this; the index page links to it.
const params = new URLSearchParams(location.search)
setGlobals(params)

const fixture = fixtures.find((candidate) => candidate.id === params.get('id'))
const root = document.getElementById('root')!

if (!fixture) {
  root.textContent = `No fixture with the id "${params.get('id')}". See the index page.`
} else {
  document.title = `${fixture.title} / ${fixture.name}`
  const { Component } = fixture
  // 1rem around the state unless it asks for the whole page; the inner
  // wrapper is the padding every fixture has.
  createRoot(root).render(
    <div style={fixture.fullscreen ? undefined : { padding: '1rem' }}>
      <div className="bg-background text-foreground p-6">
        <Component />
      </div>
    </div>,
  )
}
