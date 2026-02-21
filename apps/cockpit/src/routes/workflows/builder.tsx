import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from '../__root';
import { WorkflowBuilderPage } from './workflow-builder-page';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workflows/builder',
  component: () => <WorkflowBuilderPage mode="create" />,
});
