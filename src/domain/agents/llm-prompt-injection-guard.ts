/**
 * Prompt injection detection for RAG retrieval flows (bead-tz6c).
 *
 * When user-supplied text or retrieved documents are interpolated into an LLM
 * prompt template, an attacker can embed "injection" directives that override
 * the system instructions.  This module provides heuristic detection for known
 * injection patterns.
 *
 * Detection is best-effort (no heuristic catches every attack), so this acts as
 * a defense-in-depth layer alongside output validation (llm-output-guard) and
 * agency boundaries (agent-agency-boundary-v1).
 *
 * All functions are pure, dependency-free, and suitable for the domain layer.
 */

// ---------------------------------------------------------------------------
// Detection result
// ---------------------------------------------------------------------------

export type PromptInjectionSignal =
  | Readonly<{ detected: false }>
  | Readonly<{
      detected: true;
      /** Which heuristic fired. */
      pattern: PromptInjectionPattern;
      /** Character offset of the match start. */
      offset: number;
    }>;

export type PromptInjectionPattern =
  | 'SystemRoleOverride'
  | 'InstructionDelimiterBreakout'
  | 'IgnorePreviousInstructions'
  | 'EncodedPayload'
  | 'MarkdownInjection';

// ---------------------------------------------------------------------------
// Heuristics
// ---------------------------------------------------------------------------

/**
 * Patterns that attempt to override the system role or re-set the context.
 * Catches variants like "System:", "[SYSTEM]", "<<SYS>>", "### System:".
 */
const SYSTEM_ROLE_OVERRIDE_RE = /(?:^|\n)\s*(?:#{1,4}\s+)?(?:\[?system\]?\s*:|<<\s*sys\s*>>)/im;

/**
 * Common delimiter breakout patterns used to escape the user/document section.
 * Catches: "---END---", "```\n[system]", "###END", "<|im_end|>", "<|im_start|>".
 */
const DELIMITER_BREAKOUT_RE =
  /(?:---\s*end\s*---|<\|im_(?:end|start)\|>|```\s*\n\s*\[?system\]?)/im;

/**
 * "Ignore previous instructions" and variations — the most common prompt
 * injection vector.
 */
const IGNORE_PREVIOUS_RE =
  /ignore\s+(?:all\s+)?(?:previous|above|prior|earlier)\s+(?:instructions?|prompts?|directives?|context)/i;

/**
 * Base64-encoded payloads embedded in user text — used to smuggle instructions
 * past naive text filters.
 */
const ENCODED_PAYLOAD_RE = /(?:base64|atob|btoa)\s*[:(]/i;

/**
 * Markdown injection: image tags or links with javascript/data URIs that could
 * exfiltrate data when rendered.
 */
const MARKDOWN_INJECTION_RE = /!\[.*?\]\((?:javascript|data)\s*:/i;

interface HeuristicRule {
  readonly pattern: PromptInjectionPattern;
  readonly regex: RegExp;
}

const HEURISTICS: readonly HeuristicRule[] = [
  { pattern: 'SystemRoleOverride', regex: SYSTEM_ROLE_OVERRIDE_RE },
  { pattern: 'InstructionDelimiterBreakout', regex: DELIMITER_BREAKOUT_RE },
  { pattern: 'IgnorePreviousInstructions', regex: IGNORE_PREVIOUS_RE },
  { pattern: 'EncodedPayload', regex: ENCODED_PAYLOAD_RE },
  { pattern: 'MarkdownInjection', regex: MARKDOWN_INJECTION_RE },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scan a text fragment (user query, retrieved document chunk, etc.) for
 * known prompt injection patterns.
 *
 * Returns the first signal detected, or `{ detected: false }` if no
 * heuristic fires.  Run this on every untrusted text before interpolation
 * into a prompt template.
 *
 * @example
 * ```ts
 * const signal = detectPromptInjection(userQuery);
 * if (signal.detected) {
 *   log.warn('Prompt injection attempt', { pattern: signal.pattern });
 *   return err({ kind: 'PromptInjectionBlocked' });
 * }
 * ```
 */
export function detectPromptInjection(text: string): PromptInjectionSignal {
  for (const rule of HEURISTICS) {
    const match = rule.regex.exec(text);
    if (match) {
      return {
        detected: true,
        pattern: rule.pattern,
        offset: match.index,
      };
    }
  }
  return { detected: false };
}

/**
 * Scan multiple text fragments and return all detected signals.
 *
 * Useful for batch-scanning retrieved RAG chunks before assembling the
 * prompt context window.
 */
export function detectPromptInjectionBatch(
  texts: readonly string[],
): readonly (PromptInjectionSignal & { readonly index: number })[] {
  const results: (PromptInjectionSignal & { readonly index: number })[] = [];
  for (let i = 0; i < texts.length; i++) {
    const signal = detectPromptInjection(texts[i] ?? '');
    if (signal.detected) {
      results.push({ ...signal, index: i });
    }
  }
  return results;
}
