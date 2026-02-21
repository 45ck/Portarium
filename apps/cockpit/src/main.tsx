import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { hydrateQueryCacheFromStorage, startQueryCachePersistence } from './lib/query-client';
import './index.css';

async function bootstrap() {
  hydrateQueryCacheFromStorage();
  const stopPersist = startQueryCachePersistence();

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

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      stopPersist();
    });
  }
}

bootstrap();
