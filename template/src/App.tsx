import { createBrowserRouter, RouterProvider } from 'react-router'
import { AppShell, LoginRoute, RegisterRoute, RouteErrorBoundary } from '@tristan2828/ui-foundation'
import { NAV_ITEMS } from '@/nav'
import { HomeRoute } from '@/routes/home'
import { WidgetFormRoute } from '@/routes/widgets/widget-form'
import { WidgetViewRoute } from '@/routes/widgets/widget-view'
import { WidgetsTableRoute } from '@/routes/widgets/widgets-table'

const router = createBrowserRouter([
  // Siblings of the AppShell tree, not children of it — AppShell redirects
  // to /login when unauthenticated, so these must sit outside that
  // redirect or the two would loop. An app without self-service sign-up
  // drops /register and renders <LoginRoute registerPath={null} />.
  { path: '/login', element: <LoginRoute />, errorElement: <RouteErrorBoundary /> },
  { path: '/register', element: <RegisterRoute />, errorElement: <RouteErrorBoundary /> },
  {
    path: '/',
    element: <AppShell title="UI Foundation" nav={NAV_ITEMS} />,
    children: [
      { index: true, element: <HomeRoute />, errorElement: <RouteErrorBoundary /> },
      {
        path: 'widgets',
        element: <WidgetsTableRoute />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'widgets/new',
        element: <WidgetFormRoute />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'widgets/:id',
        element: <WidgetViewRoute />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'widgets/:id/edit',
        element: <WidgetFormRoute />,
        errorElement: <RouteErrorBoundary />,
      },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
