import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from '../__root';
import { WorkflowBuilderPage } from './workflow-builder-page';

function EditWorkflowBuilderRoute() {
  const { workflowId } = Route.useParams();
  return <WorkflowBuilderPage mode="edit" workflowId={workflowId} />;
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workflows/$workflowId/edit',
  component: EditWorkflowBuilderRoute,
});
