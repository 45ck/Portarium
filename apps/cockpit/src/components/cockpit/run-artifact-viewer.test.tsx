// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ArtifactV1 } from '@portarium/cockpit-types';
import { RunArtifactViewer } from './run-artifact-viewer';

const artifact: ArtifactV1 = {
  schemaVersion: 1,
  artifactId: 'art-demo-1',
  runId: 'run-demo-1',
  mimeType: 'text/markdown',
  sizeBytes: 128,
  storageRef: 'artifacts/run-demo-1.md',
  hashSha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  createdAtIso: '2026-04-01T00:00:00.000Z',
  mediaRefs: [
    {
      type: 'gif',
      url: './clips/approval-gate-demo.gif',
      sha256: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    },
    {
      type: 'mp4',
      url: './clips/approval-gate-demo.mp4',
      sha256: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    },
  ],
};

afterEach(() => cleanup());

describe('RunArtifactViewer', () => {
  it('renders markdown headings and narrative text', () => {
    render(
      <RunArtifactViewer
        artifact={artifact}
        markdown={'# Demo: Approval gate unblocks run\n\nShows: approval flow.'}
      />,
    );

    expect(screen.getByRole('heading', { name: /demo: approval gate unblocks run/i })).toBeTruthy();
    expect(screen.getByText('Shows: approval flow.')).toBeTruthy();
    expect(screen.getByText('art-demo-1')).toBeTruthy();
  });

  it('renders gif image embeds from ArtifactV1 media refs', () => {
    render(
      <RunArtifactViewer
        artifact={artifact}
        markdown={'# Demo\n\n![Approval flow](./clips/approval-gate-demo.gif)'}
      />,
    );

    const image = screen.getByRole<HTMLImageElement>('img', { name: /approval flow/i });
    expect(image.src).toContain('/clips/approval-gate-demo.gif');
    expect(screen.getByText(/gif/i)).toBeTruthy();
    expect(screen.getByText(/sha256:bbbbbbbbbbbb/i)).toBeTruthy();
  });

  it('renders mp4 embeds as inline video', () => {
    render(
      <RunArtifactViewer
        artifact={artifact}
        markdown={'# Demo\n\n![Approval flow](./clips/approval-gate-demo.mp4)'}
      />,
    );

    const video = screen.getByLabelText<HTMLVideoElement>('Approval flow');
    expect(video.tagName).toBe('VIDEO');
    expect(video.querySelector('source')?.getAttribute('src')).toBe(
      './clips/approval-gate-demo.mp4',
    );
    expect(screen.getByText(/mp4/i)).toBeTruthy();
    expect(screen.getByText(/sha256:cccccccccccc/i)).toBeTruthy();
  });
});
