// <EditableValue> needs a host that runs editing in place: an EntityView,
// a DataTable or an EditInPlaceScope. Outside one it throws, naming them;
// inside a scope it renders. The browser behaviour (autosave, the leave
// guard, two values in one scope) is e2e/edit-in-place-scope.spec.ts.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { editInPlace } from '../src/components/app/edit-in-place'
import { EditInPlaceScope } from '../src/components/app/edit-in-place-scope'
import { EditableValue } from '../src/components/app/editable-value'

const name = editInPlace<string>({
  kind: 'text',
  value: 'Shopping',
  save: async () => {},
  control: (props) => <input id={props.id} defaultValue={props.value} aria-label={props.label} />,
})

describe('EditInPlaceScope', () => {
  it('lets an <EditableValue> render on a page of the app’s own', () => {
    const html = renderToStaticMarkup(
      <EditInPlaceScope>
        <EditableValue label="Name" edit={name}>
          Shopping
        </EditableValue>
      </EditInPlaceScope>,
    )
    expect(html).toContain('Shopping')
    expect(html).toContain('Edit Name')
  })

  it('outside any host, <EditableValue> throws, naming the hosts', () => {
    // React logs the error it rethrows; kept out of the test's output.
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() => renderToStaticMarkup(<EditableValue label="Name" edit={name} />)).toThrow(
        /<EntityView>.*<EditInPlaceScope>/,
      )
    } finally {
      quiet.mockRestore()
    }
  })
})
