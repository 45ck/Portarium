/**
 * Contract gate: LLM output validation guards (bead-tz6c).
 *
 * Pins the exact behaviour of `guardLlmTextOutput`.
 */

import { describe, expect, it } from 'vitest';

import { LLM_TEXT_OUTPUT_MAX_CHARS, guardLlmTextOutput } from './llm-output-guard.js';

const repeat = (ch: string, n: number) => ch.repeat(n);

describe('guardLlmTextOutput', () => {
  it('returns null for a normal short text output', () => {
    expect(guardLlmTextOutput('The deployment is complete and ready for review.')).toBeNull();
  });

  it('returns null for output at the exact character limit', () => {
    expect(guardLlmTextOutput(repeat('x', LLM_TEXT_OUTPUT_MAX_CHARS))).toBeNull();
  });

  it('returns OutputTooLong when content exceeds the limit', () => {
    const tooLong = repeat('x', LLM_TEXT_OUTPUT_MAX_CHARS + 1);
    expect(guardLlmTextOutput(tooLong)).toMatchObject({
      kind: 'OutputTooLong',
      maxChars: LLM_TEXT_OUTPUT_MAX_CHARS,
      actualChars: LLM_TEXT_OUTPUT_MAX_CHARS + 1,
    });
  });

  it('returns ForbiddenControlCharacters for a NUL byte', () => {
    expect(guardLlmTextOutput('hello\x00world')).toMatchObject({
      kind: 'ForbiddenControlCharacters',
    });
  });

  it('returns ForbiddenControlCharacters for a SOH byte', () => {
    expect(guardLlmTextOutput('hello\x01')).toMatchObject({
      kind: 'ForbiddenControlCharacters',
    });
  });

  it('returns ForbiddenControlCharacters for a VT (U+000B) byte', () => {
    expect(guardLlmTextOutput('text\x0Bmore')).toMatchObject({
      kind: 'ForbiddenControlCharacters',
    });
  });

  it('returns ForbiddenControlCharacters for DEL (U+007F)', () => {
    expect(guardLlmTextOutput('del\x7F')).toMatchObject({
      kind: 'ForbiddenControlCharacters',
    });
  });

  it('returns null for TAB, LF, and CR (allowed whitespace)', () => {
    expect(guardLlmTextOutput('line1\nline2\r\nindented\ttab')).toBeNull();
  });

  it('returns NonNormalizedUnicode for NFD-encoded content', () => {
    // é as NFD: U+0065 U+0301
    const nfd = '\u0065\u0301';
    expect(guardLlmTextOutput(nfd)).toMatchObject({ kind: 'NonNormalizedUnicode' });
  });

  it('returns null for NFC-normalised unicode', () => {
    // é as NFC: U+00E9
    expect(guardLlmTextOutput('\u00E9')).toBeNull();
  });

  it('returns UnsafeUrlPattern for javascript: URI', () => {
    expect(guardLlmTextOutput('Click here: javascript:alert(1)')).toMatchObject({
      kind: 'UnsafeUrlPattern',
    });
  });

  it('returns UnsafeUrlPattern for javascript: URI with whitespace', () => {
    expect(guardLlmTextOutput('javascript :alert(1)')).toMatchObject({
      kind: 'UnsafeUrlPattern',
    });
  });

  it('returns UnsafeUrlPattern for non-image data: URI', () => {
    expect(guardLlmTextOutput('data:text/html,<script>alert(1)</script>')).toMatchObject({
      kind: 'UnsafeUrlPattern',
    });
  });

  it('returns null for an image data: URI (allowed)', () => {
    expect(guardLlmTextOutput('data:image/png;base64,abc123==')).toBeNull();
  });

  it('returns null for image/jpeg data: URI (allowed)', () => {
    expect(guardLlmTextOutput('data:image/jpeg;base64,abc123==')).toBeNull();
  });

  it('returns null for a multi-line reasoning trace with allowed whitespace', () => {
    const trace =
      'Step 1: Analyse the request.\n\tResult: deployment is safe.\nStep 2: Issue recommendation.';
    expect(guardLlmTextOutput(trace)).toBeNull();
  });
});
