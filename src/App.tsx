import { createBrowserRouter, RouterProvider } from 'react-router'
import { AppShell } from '@/components/app/app-shell'
import { RouteErrorBoundary } from '@/components/app/route-error-boundary'
import { HomeRoute } from '@/routes/home'
import { LoginRoute } from '@/routes/login'
import { RegisterRoute } from '@/routes/register'
import { WidgetFormRoute } from '@/routes/widgets/widget-form'
import { WidgetsTableRoute } from '@/routes/widgets/widgets-table'

const router = createBrowserRouter([
  // Sibling to the AppShell tree, not a child of it — AppShell redirects
  // to here when unauthenticated, so this route must sit outside that
  // redirect or the two would loop.
  { path: '/login', element: <LoginRoute />, errorElement: <RouteErrorBoundary /> },
  { path: '/register', element: <RegisterRoute />, errorElement: <RouteErrorBoundary /> },
  {
    path: '/',
    element: <AppShell />,
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
