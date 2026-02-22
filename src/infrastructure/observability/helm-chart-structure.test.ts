import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const chartRoot = resolve(__dirname, '../../../infra/helm/otel-collector');

describe('OTel Collector Helm chart — structural requirements', () => {
  it('Chart.yaml exists', () => {
    expect(existsSync(resolve(chartRoot, 'Chart.yaml'))).toBe(true);
  });

  it('values.yaml exists', () => {
    expect(existsSync(resolve(chartRoot, 'values.yaml'))).toBe(true);
  });

  it('environment-specific values files exist', () => {
    expect(existsSync(resolve(chartRoot, 'values-dev.yaml'))).toBe(true);
    expect(existsSync(resolve(chartRoot, 'values-staging.yaml'))).toBe(true);
    expect(existsSync(resolve(chartRoot, 'values-prod.yaml'))).toBe(true);
  });

  describe('templates/', () => {
    const requiredTemplates = [
      '_helpers.tpl',
      'deployment.yaml',
      'service.yaml',
      'configmap.yaml', // cspell:disable-line
      'serviceaccount.yaml', // cspell:disable-line
      'secret.yaml',
    ];

    for (const tpl of requiredTemplates) {
      it(`has template file: ${tpl}`, () => {
        expect(existsSync(resolve(chartRoot, 'templates', tpl))).toBe(true);
      });
    }

    it('has no unexpected non-template files', () => {
      const files = readdirSync(resolve(chartRoot, 'templates'));
      for (const f of files) {
        expect(f.endsWith('.yaml') || f.endsWith('.tpl')).toBe(true);
      }
    });
  });
});
