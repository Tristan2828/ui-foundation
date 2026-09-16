import { createBrowserRouter, RouterProvider } from 'react-router'
import { AppShell } from '@/components/app/app-shell'
import { RouteErrorBoundary } from '@/components/app/route-error-boundary'
import { HomeRoute } from '@/routes/home'
import { KitchenSinkRoute } from '@/routes/kitchen-sink'
import { WidgetFormRoute } from '@/routes/widgets/widget-form'
import { WidgetsTableRoute } from '@/routes/widgets/widgets-table'

const router = createBrowserRouter([
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
      {
        path: 'kitchen-sink',
        element: <KitchenSinkRoute />,
        errorElement: <RouteErrorBoundary />,
      },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
