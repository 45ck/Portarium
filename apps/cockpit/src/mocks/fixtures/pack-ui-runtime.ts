import type { RuntimeUiTemplate, WorkspacePackUiRuntime } from '@/lib/packs/types';

export const SCM_CHANGE_REQUEST_TEMPLATE: RuntimeUiTemplate = {
  schemaVersion: 1,
  templateId: 'ui-scm-change-request-form',
  packId: 'scm.change-management',
  namespace: 'scm',
  schemaRef: 'schemas/change-control-extension.json',
  fields: [
    { fieldName: 'changeType', widget: 'select', label: 'Change type' },
    { fieldName: 'rollbackPlanRef', widget: 'text', label: 'Rollback plan reference' },
    { fieldName: 'evidenceBundleRef', widget: 'text', label: 'Evidence bundle reference' },
  ],
};

export const CORE_CHANGE_REQUEST_TEMPLATE: RuntimeUiTemplate = {
  schemaVersion: 1,
  templateId: 'ui-scm-change-request-form',
  packId: 'core.base',
  namespace: 'core',
  schemaRef: 'schemas/change-control-extension.json',
  fields: [
    { fieldName: 'changeType', widget: 'select', label: 'Change type' },
    { fieldName: 'summary', widget: 'textarea', label: 'Summary' },
  ],
};

export const DEMO_PACK_UI_RUNTIME: WorkspacePackUiRuntime = {
  lock: {
    packs: [{ id: 'scm.change-management', version: '1.0.0' }],
  },
  templates: [SCM_CHANGE_REQUEST_TEMPLATE],
  coreTemplates: [CORE_CHANGE_REQUEST_TEMPLATE],
  themes: [
    {
      packId: 'scm.change-management',
      tokens: {
        '--primary': 'hsl(258 90% 56%)',
        '--accent': 'hsl(258 90% 96%)',
        '--ring': 'hsl(258 90% 56%)',
      },
    },
  ],
  schemas: {
    'schemas/change-control-extension.json': {
      title: 'Change Request',
      type: 'object',
      required: ['changeType', 'summary'],
      properties: {
        changeType: { type: 'string', title: 'Change type', enum: ['Standard', 'Emergency'] },
        summary: { type: 'string', title: 'Summary' },
        rollbackPlanRef: { type: 'string', title: 'Rollback plan reference' },
        evidenceBundleRef: { type: 'string', title: 'Evidence bundle reference' },
      },
    },
  },
};

export const DEFAULT_PACK_UI_RUNTIME: WorkspacePackUiRuntime = {
  lock: { packs: [] },
  templates: [],
  coreTemplates: [CORE_CHANGE_REQUEST_TEMPLATE],
  themes: [],
  schemas: {
    'schemas/change-control-extension.json': {
      title: 'Change Request',
      type: 'object',
      properties: {
        changeType: { type: 'string', title: 'Change type', enum: ['Standard', 'Emergency'] },
        summary: { type: 'string', title: 'Summary' },
      },
      required: ['changeType'],
    },
  },
};
