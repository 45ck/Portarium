import '../src/index.css'
import type { Preview } from '@storybook/react'

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'cockpit',
      values: [
        { name: 'cockpit', value: '#f6f6f3' },
        { name: 'white', value: '#ffffff' },
        { name: 'dark', value: '#141414' },
      ],
    },
    a11y: {
      config: {
        rules: [{ id: 'color-contrast', enabled: true }],
      },
    },
    docs: {
      toc: true,
    },
  },
}
export default preview
