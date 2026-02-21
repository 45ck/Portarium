// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  applyThemeTokens,
  collectSafeThemeTokens,
  isRenderableTemplate,
  resolveTemplate,
} from './pack-runtime';
import {
  CORE_CHANGE_REQUEST_TEMPLATE,
  DEFAULT_PACK_UI_RUNTIME,
  DEMO_PACK_UI_RUNTIME,
  SCM_CHANGE_REQUEST_TEMPLATE,
} from '@/mocks/fixtures/pack-ui-runtime';
import type { WorkspacePackUiRuntime } from '@/lib/packs/types';

describe('pack runtime resolution', () => {
  it('prefers enabled pack template, then falls back to core template', () => {
    const packResolved = resolveTemplate(DEMO_PACK_UI_RUNTIME, 'ui-scm-change-request-form');
    expect(packResolved?.source).toBe('pack');
    expect(packResolved?.template.packId).toBe('scm.change-management');

    const fallbackRuntime: WorkspacePackUiRuntime = {
      ...DEMO_PACK_UI_RUNTIME,
      lock: { packs: [] },
      templates: [SCM_CHANGE_REQUEST_TEMPLATE],
      coreTemplates: [CORE_CHANGE_REQUEST_TEMPLATE],
    };
    const coreResolved = resolveTemplate(fallbackRuntime, 'ui-scm-change-request-form');
    expect(coreResolved?.source).toBe('core');
    expect(coreResolved?.template.packId).toBe('core.base');
  });

  it('rejects non-renderable templates and uses core fallback', () => {
    const runtime: WorkspacePackUiRuntime = {
      ...DEMO_PACK_UI_RUNTIME,
      templates: [
        {
          ...SCM_CHANGE_REQUEST_TEMPLATE,
          fields: [{ fieldName: '', widget: 'text', label: 'Broken' }],
        },
      ],
      coreTemplates: [CORE_CHANGE_REQUEST_TEMPLATE],
    };
    expect(isRenderableTemplate(runtime.templates[0]!)).toBe(false);
    const resolved = resolveTemplate(runtime, 'ui-scm-change-request-form');
    expect(resolved?.source).toBe('core');
  });
});

describe('pack theme token safety', () => {
  it('only keeps allowed tokens with safe values', () => {
    const runtime: WorkspacePackUiRuntime = {
      ...DEFAULT_PACK_UI_RUNTIME,
      lock: { packs: [{ id: 'scm.change-management', version: '1.0.0' }] },
      themes: [
        {
          packId: 'scm.change-management',
          tokens: {
            '--primary': 'hsl(258 90% 56%)',
            '--bad-token': 'hsl(0 0% 0%)',
            '--accent': 'javascript:alert(1)',
          },
        },
      ],
    };
    const safe = collectSafeThemeTokens(runtime);
    expect(safe).toEqual({ '--primary': 'hsl(258 90% 56%)' });
  });

  it('applies collected safe tokens to the provided root element', () => {
    const root = {
      style: {
        values: new Map<string, string>(),
        setProperty(token: string, value: string) {
          this.values.set(token, value);
        },
        getPropertyValue(token: string) {
          return this.values.get(token) ?? '';
        },
      },
    } as unknown as HTMLElement;
    const applied = applyThemeTokens(DEMO_PACK_UI_RUNTIME, root);
    expect(applied['--primary']).toBe('hsl(258 90% 56%)');
    expect(root.style.getPropertyValue('--primary')).toBe('hsl(258 90% 56%)');
  });
});
