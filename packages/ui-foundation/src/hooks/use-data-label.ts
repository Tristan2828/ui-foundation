import { useQuery } from '@tanstack/react-query'
import { getDataLabel } from '@/api/gateway/environment'

// Which data the backend serves (GET /environment), for
// DataEnvironmentBanner. It can't change while the page is open, so it's
// asked once per load: never stale, never refetched on focus. And it's the
// same whoever is signed in, so AuthProvider keeps it across session
// changes instead of dropping it with the user's rows.
export const DATA_LABEL_QUERY_KEY = ['environment'] as const

/** The backend's data label ("dev"), or null for production data, a failed request, or while it loads. */
export function useDataLabel(): string | null {
  const { data } = useQuery({
    queryKey: DATA_LABEL_QUERY_KEY,
    queryFn: getDataLabel,
    staleTime: Infinity,
    gcTime: Infinity,
  })
  return data ?? null
}
