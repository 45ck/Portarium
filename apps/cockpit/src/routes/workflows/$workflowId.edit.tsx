import { createRoute, redirect } from '@tanstack/react-router';
import { Route as rootRoute } from '../__root';
import { WorkflowBuilderPage } from './workflow-builder-page';
import { shouldShowInternalCockpitSurfaces } from '@/lib/shell/navigation';

function EditWorkflowBuilderRoute() {
  const { workflowId } = Route.useParams();
  return <WorkflowBuilderPage mode="edit" workflowId={workflowId} />;
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workflows/$workflowId/edit',
  beforeLoad: ({ params }) => {
    if (!shouldShowInternalCockpitSurfaces()) {
      throw redirect({
        to: '/workflows/$workflowId',
        params: { workflowId: params.workflowId },
      });
    }
  },
  component: EditWorkflowBuilderRoute,
});
