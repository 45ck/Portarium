import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import './index.css';

async function bootstrap() {
  // Mock mode: dev/test only. Production must always hit live APIs.
  if (import.meta.env.DEV) {
    const { worker } = await import('./mocks/browser');
    const { loadActiveDataset } = await import('./mocks/handlers');
    await loadActiveDataset();
    await worker.start({ onUnhandledRequest: 'bypass' });
  }

  const root = document.getElementById('root')!;
  createRoot(root).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}

bootstrap();
