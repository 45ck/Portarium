// @vitest-environment jsdom

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ApprovalSummary } from '@portarium/cockpit-types';
import { ApprovalListPanel } from './approval-list-panel';

const BASE_APPROVAL: ApprovalSummary = {
  schemaVersion: 1,
  approvalId: 'appr-001',
  workspaceId: 'ws-test',
  runId: 'run-test-001',
  planId: 'plan-test-001',
  prompt: 'Approve deployment to production?',
  status: 'Pending',
  requestedAtIso: '2026-03-11T00:00:00.000Z',
  requestedByUserId: 'user-001',
};

const BASE_APPROVAL_WITH_PROPOSAL: ApprovalSummary = {
  ...BASE_APPROVAL,
  agentActionProposal: {
    proposalId: 'prop-001',
    agentId: 'agent-test-1',
    toolName: 'write:file',
    toolCategory: 'Mutation',
    blastRadiusTier: 'HumanApprove',
    rationale: 'Writing to production config requires human oversight.',
  },
};

function renderPanel(items: ApprovalSummary[] = [BASE_APPROVAL_WITH_PROPOSAL]) {
  const onSelect = vi.fn();
  render(
    <ApprovalListPanel
      items={items}
      pendingCount={items.filter((a) => a.status === 'Pending').length}
      selectedId={null}
      onSelect={onSelect}
    />,
  );
  return { onSelect };
}

describe('ApprovalListPanel — agentActionProposal metadata display', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders tool name when agentActionProposal is present', () => {
    renderPanel();
    expect(screen.getByText('write:file')).toBeTruthy();
  });

  it('renders Mutation category badge for Mutation tools', () => {
    renderPanel();
    expect(screen.getByText('Mutation')).toBeTruthy();
  });

  it('renders Read-only badge for ReadOnly tools', () => {
    renderPanel([
      {
        ...BASE_APPROVAL_WITH_PROPOSAL,
        agentActionProposal: {
          ...BASE_APPROVAL_WITH_PROPOSAL.agentActionProposal!,
          toolCategory: 'ReadOnly',
        },
      },
    ]);
    expect(screen.getByText('Read-only')).toBeTruthy();
  });

  it('renders Dangerous badge for Dangerous tools', () => {
    renderPanel([
      {
        ...BASE_APPROVAL_WITH_PROPOSAL,
        agentActionProposal: {
          ...BASE_APPROVAL_WITH_PROPOSAL.agentActionProposal!,
          toolCategory: 'Dangerous',
        },
      },
    ]);
    expect(screen.getByText('Dangerous')).toBeTruthy();
  });

  it('renders Unclassified badge for unclassified tool categories', () => {
    renderPanel([
      {
        ...BASE_APPROVAL_WITH_PROPOSAL,
        agentActionProposal: {
          ...BASE_APPROVAL_WITH_PROPOSAL.agentActionProposal!,
          toolCategory: 'Unknown',
        },
      },
    ]);
    expect(screen.getByText('Unclassified')).toBeTruthy();
    expect(screen.queryByText('Unknown')).toBeNull();
  });

  it('does not render bot icon or category badge when agentActionProposal is absent', () => {
    renderPanel([BASE_APPROVAL]);
    // tool name should not appear
    expect(screen.queryByText('write:file')).toBeNull();
    // category labels should not appear
    expect(screen.queryByText('Mutation')).toBeNull();
    expect(screen.queryByText('Read-only')).toBeNull();
  });

  it('renders approval prompt', () => {
    renderPanel();
    expect(screen.getByText('Approve deployment to production?')).toBeTruthy();
  });

  it('renders real monitor titles for stale object-placeholder prompts', () => {
    renderPanel([
      {
        ...BASE_APPROVAL,
        prompt: 'Review monitor item: [object Object]',
        approvalPacket: {
          schemaVersion: 1,
          packetId: 'packet-monitor-1',
          artifacts: [
            {
              artifactId: 'artifact-monitor-1',
              title: 'OpenClaw approval request',
              mimeType: 'application/json',
              role: 'primary',
            },
          ],
          reviewDocs: [{ title: 'Review brief', markdown: '# Review' }],
          requestedCapabilities: [
            {
              capabilityId: 'openclaw.email_query',
              reason: 'Review redacted monitor signal before any follow-up proposal.',
              required: true,
            },
          ],
          planScope: {
            planId: 'plan-monitor-1',
            summary:
              'OpenClaw approval required: email_query on tenant-learning:admin-workflow-watch. Review latest standing-read monitor attention item: Tenant learning admin signal. Severity: medium.',
            actionIds: ['action-monitor-1'],
            plannedEffectIds: ['effect-monitor-1'],
          },
        },
      },
    ]);

    expect(screen.getByText('Review monitor item: Tenant learning admin signal')).toBeTruthy();
    expect(screen.queryByText(/object Object/)).toBeNull();
  });

  it('marks and scrolls the selected approval row', () => {
    render(
      <ApprovalListPanel
        items={[BASE_APPROVAL_WITH_PROPOSAL]}
        pendingCount={1}
        selectedId={BASE_APPROVAL_WITH_PROPOSAL.approvalId}
        onSelect={vi.fn()}
      />,
    );

    const row = screen.getByRole('button', { name: /approve deployment/i });
    expect(row.getAttribute('aria-current')).toBe('true');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
