import { useIsPhone } from "@/hooks/use-is-phone"

// shadcn's hook (the sidebar, sonner and the package's own code read it),
// answered by useIsPhone so the 768px breakpoint lives in one place. Same
// result as shadcn's own `window.innerWidth < 768`, and safe where
// matchMedia is missing.
export function useIsMobile() {
  return useIsPhone()
}
