import '../src/index.css';
import type { Preview, Decorator } from '@storybook/react';

// Wrap each story in its theme class so CSS variables resolve correctly
const withTheme: Decorator = (Story, context) => {
  const theme = (context.globals['theme'] as string) ?? 'theme-arctic';
  const el = document.getElementById('storybook-root') ?? document.body;
  el.className = theme;
  return Story();
};

const preview: Preview = {
  decorators: [withTheme],

  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Cockpit design theme',
      defaultValue: 'theme-arctic',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'theme-arctic', title: 'Arctic Ops' },
          { value: 'theme-midnight', title: 'Midnight' },
          { value: 'theme-warm', title: 'Warm Slate' },
          { value: 'theme-quantum', title: 'Quantum' },
        ],
        showName: true,
        dynamicTitle: true,
      },
    },
  },

  parameters: {
    backgrounds: { disable: true }, // themes handle background via CSS vars
    a11y: {
      config: { rules: [{ id: 'color-contrast', enabled: true }] },
    },
    docs: { toc: true },
    chromatic: { diffThreshold: 0.1 },
  },
};

export default preview;
