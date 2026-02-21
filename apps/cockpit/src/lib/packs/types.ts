export interface RuntimePackRef {
  id: string;
  version: string;
}

export interface RuntimeUiTemplateField {
  fieldName: string;
  widget: 'text' | 'select' | 'textarea';
  label?: string;
}

export interface RuntimeUiTemplate {
  schemaVersion: 1;
  templateId: string;
  packId: string;
  namespace: string;
  schemaRef: string;
  fields: RuntimeUiTemplateField[];
}

export interface RuntimePackTheme {
  packId: string;
  tokens: Record<string, string>;
}

export interface RuntimeSchemaProperty {
  type: 'string';
  title?: string;
  enum?: string[];
}

export interface RuntimeSchemaDefinition {
  title: string;
  type: 'object';
  properties: Record<string, RuntimeSchemaProperty>;
  required?: string[];
}

export interface WorkspacePackUiRuntime {
  lock: {
    packs: RuntimePackRef[];
  };
  templates: RuntimeUiTemplate[];
  coreTemplates: RuntimeUiTemplate[];
  themes: RuntimePackTheme[];
  schemas: Record<string, RuntimeSchemaDefinition>;
}
