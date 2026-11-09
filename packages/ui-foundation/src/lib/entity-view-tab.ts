// EntityView's tabs (4.76, #303): the selected tab is `?tab=<slug>`, so a
// screen can link straight to one (`/things/3?tab=${entityViewTabSlug('Used in')}`).
/** A tab's name as it reads in the address: "Used in" is `used-in`. */
export function entityViewTabSlug(name: string) {
  return (
    name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'tab'
  )
}
