import type { RuntimeUiTemplate, WorkspacePackUiRuntime } from '@/lib/packs/types';

export type TemplateSource = 'pack' | 'core';

export interface ResolvedTemplate {
  source: TemplateSource;
  template: RuntimeUiTemplate;
}

const ALLOWED_WIDGETS = new Set(['text', 'select', 'textarea']);

const ALLOWED_THEME_TOKENS = new Set([
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--destructive',
  '--destructive-foreground',
  '--border',
  '--input',
  '--ring',
  '--success',
  '--success-foreground',
  '--warning',
  '--warning-foreground',
  '--info',
  '--info-foreground',
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
  '--sidebar',
  '--sidebar-foreground',
  '--sidebar-primary',
  '--sidebar-primary-foreground',
  '--sidebar-accent',
  '--sidebar-accent-foreground',
  '--sidebar-border',
  '--sidebar-ring',
  '--radius',
]);

const SAFE_TOKEN_VALUE_PATTERN =
  /^(hsl|oklch)\([^;{}<>]+\)$|^#[0-9a-fA-F]{3,8}$|^[0-9]+(\.[0-9]+)?(rem|px|%)$/;

export function resolveTemplate(
  runtime: WorkspacePackUiRuntime,
  templateId: string,
): ResolvedTemplate | null {
  const enabledPackIds = new Set(runtime.lock.packs.map((pack) => pack.id));

  const fromPack =
    runtime.templates.find(
      (template) =>
        template.templateId === templateId &&
        enabledPackIds.has(template.packId) &&
        isRenderableTemplate(template),
    ) ?? null;
  if (fromPack) return { source: 'pack', template: fromPack };

  const fromCore =
    runtime.coreTemplates.find(
      (template) => template.templateId === templateId && isRenderableTemplate(template),
    ) ?? null;
  if (fromCore) return { source: 'core', template: fromCore };

  return null;
}

export function isRenderableTemplate(template: RuntimeUiTemplate): boolean {
  if (!template.templateId || !template.packId || !template.schemaRef) return false;
  if (!Array.isArray(template.fields) || template.fields.length === 0) return false;

  const seen = new Set<string>();
  for (const field of template.fields) {
    if (!field.fieldName?.trim()) return false;
    if (seen.has(field.fieldName)) return false;
    seen.add(field.fieldName);
    if (!ALLOWED_WIDGETS.has(field.widget)) return false;
  }

  return true;
}

export function isAllowedThemeToken(token: string): boolean {
  return ALLOWED_THEME_TOKENS.has(token);
}

export function isSafeThemeTokenValue(value: string): boolean {
  return SAFE_TOKEN_VALUE_PATTERN.test(value.trim());
}

export function collectSafeThemeTokens(runtime: WorkspacePackUiRuntime): Record<string, string> {
  const enabledPackIds = new Set(runtime.lock.packs.map((pack) => pack.id));
  const collected: Record<string, string> = {};

  for (const theme of runtime.themes) {
    if (!enabledPackIds.has(theme.packId)) continue;
    for (const [token, value] of Object.entries(theme.tokens)) {
      if (!isAllowedThemeToken(token)) continue;
      if (!isSafeThemeTokenValue(value)) continue;
      collected[token] = value.trim();
    }
  }

  return collected;
}

export function applyThemeTokens(
  runtime: WorkspacePackUiRuntime,
  root: HTMLElement | null = typeof document === 'undefined' ? null : document.documentElement,
): Record<string, string> {
  const safeTokens = collectSafeThemeTokens(runtime);
  if (!root) return safeTokens;

  for (const [token, value] of Object.entries(safeTokens)) {
    root.style.setProperty(token, value);
  }

  return safeTokens;
}
