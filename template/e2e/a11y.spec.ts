import { defineA11ySuite } from '@tristan2828/ui-foundation/testing'

// Every page in the sidebar is found and checked automatically, in light
// and dark mode. Form screens aren't in the sidebar: add each entity's
// create route here, plus an edit route when the form shows something only
// existing data has (the Wireless Mouse's tag chips, with their remove
// buttons).
defineA11ySuite({
  formRoutes: ['/widgets/new', '/widgets/1/edit'],
  loggedOutRoutes: ['/login', '/register'],
})
