import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes'

// Thin wrapper so the rest of the app imports from @/components/theme-provider
// rather than next-themes directly. Toggles the .dark class that
// src/styles/theme.css already keys its dark-mode block on.
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
