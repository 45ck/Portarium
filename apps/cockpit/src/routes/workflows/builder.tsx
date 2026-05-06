import { createRoute, redirect } from '@tanstack/react-router';
import { Route as rootRoute } from '../__root';
import { WorkflowBuilderPage } from './workflow-builder-page';
import { shouldShowInternalCockpitSurfaces } from '@/lib/shell/navigation';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workflows/builder',
  beforeLoad: () => {
    if (!shouldShowInternalCockpitSurfaces()) {
      throw redirect({ to: '/workflows' });
    }
  },
  component: () => <WorkflowBuilderPage mode="create" />,
});
