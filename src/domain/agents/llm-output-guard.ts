/**
 * LLM output validation guards (bead-tz6c).
 *
 * Autonomous agents and LLM-powered components produce free-form text and
 * structured JSON that flows into the Portarium evidence log, approval
 * prompts, and workflow artefacts.  Before any LLM-generated content is
 * persisted or forwarded it MUST pass the following checks:
 *
 *   1. Size guard — prevents memory exhaustion and storage quota bypass.
 *   2. Forbidden control characters — protects downstream parsers and renderers.
 *   3. Unicode normalisation — ensures consistent equality and storage semantics.
 *   4. Unsafe URL patterns — prevents XSS via data: / javascript: URI injection.
 *
 * All checks are pure, dependency-free functions suitable for the domain layer.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maximum characters allowed in a single LLM text output.
 *
 * 65 536 chars (≈ 64 KiB of ASCII) is generous for reasoning traces, plan
 * summaries, and audit notes while still bounding unbounded generation.
 */
export const LLM_TEXT_OUTPUT_MAX_CHARS = 65_536;

// ---------------------------------------------------------------------------
// Violation types
// ---------------------------------------------------------------------------

export type LlmOutputViolation =
  | Readonly<{
      kind: 'OutputTooLong';
      maxChars: number;
      actualChars: number;
    }>
  | Readonly<{ kind: 'ForbiddenControlCharacters' }>
  | Readonly<{ kind: 'NonNormalizedUnicode' }>
  | Readonly<{ kind: 'UnsafeUrlPattern' }>;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when `content` contains a character code that must never appear
 * in LLM output.
 *
 * Allowed whitespace: TAB (U+0009), LF (U+000A), CR (U+000D).
 * Rejected: NUL (U+0000), SOH–BS (U+0001–U+0008), VT (U+000B), FF (U+000C),
 *           SO–US (U+000E–U+001F), DEL (U+007F).
 *
 * Implemented as a character-code loop to avoid the ESLint `no-control-regex`
 * rule.
 */
function hasForbiddenControlChars(content: string): boolean {
  for (let i = 0; i < content.length; i++) {
    const code = content.codePointAt(i) ?? 0;
    const isForbidden =
      code <= 0x08 ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f) ||
      code === 0x7f;
    if (isForbidden) return true;
  }
  return false;
}

/**
 * Pattern matching potentially dangerous URI schemes that could be exploited
 * for XSS or code execution when rendered in a browser context.
 *
 * - `javascript:` — arbitrary script execution
 * - `data:` (non-image types) — HTML/SVG injection; image data: URIs are
 *   permitted for legitimate inline image use in evidence artefacts
 */
const UNSAFE_URI_SCHEME_RE =
  /(?:javascript\s*:|data\s*:(?!image\/(?:png|jpeg|gif|webp|svg\+xml)[;,]))/i;

// ---------------------------------------------------------------------------
// Public guard
// ---------------------------------------------------------------------------

/**
 * Validate a free-text LLM output string before persisting or forwarding it.
 *
 * Returns the first `LlmOutputViolation` found, or `null` if the content
 * passes all checks.
 *
 * @example
 * ```ts
 * const violation = guardLlmTextOutput(agentSummary);
 * if (violation !== null) {
 *   return err({ kind: 'ValidationFailed', message: `LLM output rejected: ${violation.kind}` });
 * }
 * ```
 */
export function guardLlmTextOutput(content: string): LlmOutputViolation | null {
  if (content.length > LLM_TEXT_OUTPUT_MAX_CHARS) {
    return {
      kind: 'OutputTooLong',
      maxChars: LLM_TEXT_OUTPUT_MAX_CHARS,
      actualChars: content.length,
    };
  }

  if (hasForbiddenControlChars(content)) {
    return { kind: 'ForbiddenControlCharacters' };
  }

  if (content !== content.normalize('NFC')) {
    return { kind: 'NonNormalizedUnicode' };
  }

  if (UNSAFE_URI_SCHEME_RE.test(content)) {
    return { kind: 'UnsafeUrlPattern' };
  }

  return null;
}
