import { describe, expect, it } from 'vitest';

import {
  classifyOpenClawToolBlastRadiusV1,
  evaluateOpenClawToolPolicyV1,
  isOpenClawToolAllowedAtTierV1,
  validateOpenClawToolPolicyTierV1,
} from './openclaw-tool-blast-radius-v1.js';

describe('classifyOpenClawToolBlastRadiusV1', () => {
  it('classifies read-only tools as Auto', () => {
    const policy = classifyOpenClawToolBlastRadiusV1('read:file');
    expect(policy.category).toBe('ReadOnly');
    expect(policy.minimumTier).toBe('Auto');
  });

  it('classifies mutating tools as HumanApprove', () => {
    const policy = classifyOpenClawToolBlastRadiusV1('write:file');
    expect(policy.category).toBe('Mutation');
    expect(policy.minimumTier).toBe('HumanApprove');
  });

  it.each(['portarium_run_start', 'portarium_run_cancel', 'portarium_approval_submit'])(
    'classifies Portarium state-changing tool %s as HumanApprove',
    (toolName) => {
      const policy = classifyOpenClawToolBlastRadiusV1(toolName);
      expect(policy.category).toBe('Mutation');
      expect(policy.minimumTier).toBe('HumanApprove');
    },
  );

  it('classifies dangerous tools as ManualOnly', () => {
    const policy = classifyOpenClawToolBlastRadiusV1('shell.exec');
    expect(policy.category).toBe('Dangerous');
    expect(policy.minimumTier).toBe('ManualOnly');
  });

  it('classifies browser automation tools as ManualOnly', () => {
    const policy = classifyOpenClawToolBlastRadiusV1('browser.playwright');
    expect(policy.category).toBe('Dangerous');
    expect(policy.minimumTier).toBe('ManualOnly');
  });

  it.each([
    'tenant.cloud_browser_status',
    'tenant.cloud_browser_query',
    'tenant.cloud_browser_capture',
    'tenant.password_manager_status',
    'tenant.auth_material_discover_metadata',
    'tenant.visual_evidence_search',
    'portarium_agent_heartbeat',
  ])('classifies read-like sensitive tool %s as Auto', (toolName) => {
    const policy = classifyOpenClawToolBlastRadiusV1(toolName);
    expect(policy.category).toBe('ReadOnly');
    expect(policy.minimumTier).toBe('Auto');
  });

  it.each([
    'tenant.cloud_browser_open',
    'tenant.cloud_browser_prepare_login',
    'gmail.message.send',
    'portarium_run_start',
    'portarium_approval_submit',
  ])('classifies effectful non-destructive tool %s as HumanApprove', (toolName) => {
    const policy = classifyOpenClawToolBlastRadiusV1(toolName);
    expect(policy.category).toBe('Mutation');
    expect(policy.minimumTier).toBe('HumanApprove');
  });

  it('defaults unknown tools to HumanApprove', () => {
    const policy = classifyOpenClawToolBlastRadiusV1('custom_tool');
    expect(policy.category).toBe('Unknown');
    expect(policy.minimumTier).toBe('HumanApprove');
  });

  it.each([
    ['web-search', 'ReadOnly', 'Auto'],
    ['scrape-website', 'ReadOnly', 'Auto'],
    ['read-crm-contact', 'ReadOnly', 'Auto'],
    ['read-analytics', 'ReadOnly', 'Auto'],
    ['draft-email', 'Mutation', 'HumanApprove'],
    ['draft-linkedin-post', 'Mutation', 'HumanApprove'],
    ['draft-blog-article', 'Mutation', 'HumanApprove'],
    ['update-crm-contact', 'Mutation', 'HumanApprove'],
    ['schedule-content', 'Mutation', 'HumanApprove'],
    ['send-email', 'Dangerous', 'ManualOnly'],
    ['publish-linkedin-post', 'Dangerous', 'ManualOnly'],
    ['publish-blog-article', 'Dangerous', 'ManualOnly'],
    ['delete-crm-contact', 'Dangerous', 'ManualOnly'],
  ] as const)('classifies Growth Studio tool %s as %s/%s', (toolName, category, minimumTier) => {
    const policy = classifyOpenClawToolBlastRadiusV1(toolName);
    expect(policy.category).toBe(category);
    expect(policy.minimumTier).toBe(minimumTier);
  });
});

describe('isOpenClawToolAllowedAtTierV1', () => {
  it('blocks dangerous tools in Auto tier', () => {
    const allowed = isOpenClawToolAllowedAtTierV1({
      toolName: 'shell.exec',
      policyTier: 'Auto',
    });
    expect(allowed).toBe(false);
  });

  it('allows dangerous tools in ManualOnly tier', () => {
    const allowed = isOpenClawToolAllowedAtTierV1({
      toolName: 'shell.exec',
      policyTier: 'ManualOnly',
    });
    expect(allowed).toBe(true);
  });
});

describe('evaluateOpenClawToolPolicyV1', () => {
  it('returns Deny with PolicyBlocked state for policy violations', () => {
    const result = evaluateOpenClawToolPolicyV1({
      toolName: 'shell.exec',
      policyTier: 'Auto',
    });

    expect(result).toMatchObject({
      decision: 'Deny',
      runState: 'PolicyBlocked',
      violation: {
        toolName: 'shell.exec',
        requiredTier: 'ManualOnly',
      },
    });
  });

  it('returns Allow for read-only tools in Auto tier', () => {
    const result = evaluateOpenClawToolPolicyV1({
      toolName: 'read:file',
      policyTier: 'Auto',
    });

    expect(result).toMatchObject({
      decision: 'Allow',
      toolPolicy: {
        toolName: 'read:file',
        category: 'ReadOnly',
        minimumTier: 'Auto',
      },
    });
  });
});

describe('validateOpenClawToolPolicyTierV1', () => {
  it('returns violations for tools above policy tier', () => {
    const violations = validateOpenClawToolPolicyTierV1({
      policyTier: 'Assisted',
      allowedTools: ['read:file', 'write:file', 'shell.exec'],
    });

    expect(violations).toHaveLength(2);
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ toolName: 'write:file', requiredTier: 'HumanApprove' }),
        expect.objectContaining({ toolName: 'shell.exec', requiredTier: 'ManualOnly' }),
      ]),
    );
  });
});
