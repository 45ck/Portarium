import { describe, expect, it } from 'vitest';

interface AlphaValidatorModule {
  validateSelfUseAlphaFile: () => Promise<{ id: string; passed: boolean; message: string }[]>;
  validateSelfUseAlphaPlan: (plan: unknown) => { id: string; passed: boolean; message: string }[];
  loadSelfUseAlphaPlan: () => Promise<Record<string, unknown>>;
}

describe('source-to-micro-saas self-use alpha validator', () => {
  it('accepts the committed alpha fixture', async () => {
    // @ts-expect-error The validator is a checked .mjs runtime script.
    const mod = (await import('./validate-self-use-alpha.mjs')) as AlphaValidatorModule;

    const assertions = await mod.validateSelfUseAlphaFile();

    expect(assertions.map((item) => [item.id, item.passed])).toEqual([
      ['chosen-workflow', true],
      ['truthful-self-use-label', true],
      ['recurring-alpha-window', true],
      ['baseline-capture', true],
      ['useful-outcome', true],
      ['required-artifacts', true],
      ['required-evidence-events', true],
      ['rollback-protocol', true],
      ['manual-fallback-protocol', true],
      ['stop-using-it-protocol', true],
      ['scorecard-metrics', true],
      ['run-ledger-template', true],
    ]);
  });

  it('fails when rollback and stop-using-it evidence are removed', async () => {
    // @ts-expect-error The validator is a checked .mjs runtime script.
    const mod = (await import('./validate-self-use-alpha.mjs')) as AlphaValidatorModule;
    const plan = await mod.loadSelfUseAlphaPlan();

    const assertions = mod.validateSelfUseAlphaPlan({
      ...plan,
      requiredEvidenceEvents: [],
      rollbackProtocol: {
        rollbackScopeLevels: [],
        rollbackTriggers: [],
        completionCriteria: [],
      },
      stopUsingItProtocol: {
        requiredTriggers: [],
        requiredFields: [],
      },
    });

    expect(assertions.filter((item) => !item.passed).map((item) => item.id)).toEqual([
      'required-evidence-events',
      'rollback-protocol',
      'stop-using-it-protocol',
    ]);
  });
});
