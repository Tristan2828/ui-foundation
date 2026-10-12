import React from 'react'
import type { Decorator, Preview } from '@storybook/react-vite'
import './storybook.css'

// Mirrors next-themes' attribute="class" behavior (see
// src/components/theme-provider.tsx) without pulling next-themes/AuthProvider
// /QueryClientProvider into story rendering — stories only need the class
// toggle, not the full app provider tree.
const withTheme: Decorator = (Story, context) => {
  const isDark = context.globals.theme === 'dark'
  document.documentElement.classList.toggle('dark', isDark)
  // On <html>, as an app sets it for the whole screen, so popups portaled
  // to <body> get it too (styles/theme.css "Large").
  const density = context.globals.density
  if (density && density !== 'default') document.documentElement.dataset.density = density
  else delete document.documentElement.dataset.density

  return React.createElement(
    'div',
    { className: 'bg-background text-foreground p-6' },
    React.createElement(Story),
  )
}

const preview: Preview = {
  // Every story gets a Docs page (@storybook/addon-docs, registered in
  // main.ts) without opting in per file.
  tags: ['autodocs'],
  globalTypes: {
    theme: {
      description: 'Light/dark theme',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: ['light', 'dark'],
        dynamicTitle: true,
      },
    },
    density: {
      description: 'data-density on <html>',
      toolbar: {
        title: 'Density',
        icon: 'grow',
        items: ['default', 'compact', 'comfortable', 'large'],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'light',
    density: 'default',
  },
  decorators: [withTheme],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
}

export default preview
