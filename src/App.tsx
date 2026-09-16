import { createBrowserRouter, RouterProvider } from 'react-router'
import { AppShell } from '@/components/app/app-shell'
import { RouteErrorBoundary } from '@/components/app/route-error-boundary'
import { HomeRoute } from '@/routes/home'
import { KitchenSinkRoute } from '@/routes/kitchen-sink'

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomeRoute />, errorElement: <RouteErrorBoundary /> },
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
