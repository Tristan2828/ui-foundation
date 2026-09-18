import React from 'react'
import type { Decorator, Preview } from '@storybook/react-vite'
import '../src/index.css'

// Mirrors next-themes' attribute="class" behavior (see
// src/components/theme-provider.tsx) without pulling next-themes/AuthProvider
// /QueryClientProvider into story rendering — stories only need the class
// toggle, not the full app provider tree.
const withTheme: Decorator = (Story, context) => {
  const isDark = context.globals.theme === 'dark'
  document.documentElement.classList.toggle('dark', isDark)

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
  },
  initialGlobals: {
    theme: 'light',
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
