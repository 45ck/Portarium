import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from '../../../__root';
import { RunArtifactViewer } from '@/components/cockpit/run-artifact-viewer';

function BeadArtifactPage() {
  const { beadId } = Route.useParams();
  const gifUrl = '/assets/demo-machine/approval-gate-demo.gif';
  const artifact = {
    schemaVersion: 1 as const,
    artifactId: `run-artifact-${beadId}`,
    runId: beadId,
    mimeType: 'text/markdown',
    sizeBytes: 0,
    storageRef: `engineering/beads/${beadId}/artifact.md`,
    hashSha256: '0000000000000000000000000000000000000000000000000000000000000000',
    createdAtIso: new Date().toISOString(),
    mediaRefs: [
      {
        type: 'gif' as const,
        url: gifUrl,
        sha256: '0000000000000000000000000000000000000000000000000000000000000000',
      },
    ],
  };
  const markdown = [
    `# Run Artifact: ${beadId}`,
    '',
    '## Demo',
    '',
    `![Approval flow](${gifUrl})`,
    '',
    'Shows: agent activity, approval review, decision rationale, and evidence receipt.',
  ].join('\n');

  return <RunArtifactViewer artifact={artifact} markdown={markdown} />;
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/engineering/beads/$beadId/artifact',
  component: BeadArtifactPage,
});
