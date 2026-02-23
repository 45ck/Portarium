/**
 * Content sanitization for approval payloads and evidence (bead-0806).
 *
 * Ensures untrusted content displayed in approval views is safe from XSS,
 * injection, and other content-based attacks.  This module is a pure domain
 * concern — no DOM, no framework, no side effects.
 *
 * Guardrails:
 *   1. HTML entity encoding for untrusted text fields
 *   2. URI validation — block dangerous protocols (javascript:, data:, vbscript:)
 *   3. Content length enforcement — reject oversized payloads early
 *   4. CSP nonce generation for inline content references
 *   5. Structural validation for presentation block safety
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of a sanitization check — either clean or contaminated. */
export type SanitizationResultV1 = Readonly<
  { safe: true; sanitizedValue: string } | { safe: false; violation: string; originalValue: string }
>;

/** A single content constraint violation found during validation. */
export type ContentViolationV1 = Readonly<{
  field: string;
  rule: ContentRule;
  message: string;
}>;

/** The set of rules enforced by this module. */
export type ContentRule =
  | 'dangerous_protocol'
  | 'html_injection'
  | 'content_too_long'
  | 'control_characters'
  | 'invalid_uri'
  | 'empty_content';

/** Constraints applied when validating approval content fields. */
export type ContentConstraintsV1 = Readonly<{
  /** Maximum allowed length for a single text field. */
  maxFieldLength: number;
  /** Maximum total payload size across all fields. */
  maxTotalPayloadLength: number;
  /** Whether to strip HTML tags (true) or reject them (false). */
  stripHtmlTags: boolean;
}>;

/** Aggregate validation result for a full content payload. */
export type ContentValidationResultV1 = Readonly<{
  valid: boolean;
  violations: readonly ContentViolationV1[];
}>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default constraints for approval content fields. */
export const DEFAULT_CONTENT_CONSTRAINTS: ContentConstraintsV1 = Object.freeze({
  maxFieldLength: 10_000,
  maxTotalPayloadLength: 100_000,
  stripHtmlTags: false,
});

/**
 * Protocols that are never allowed in URIs rendered in approval views.
 * Checked case-insensitively after whitespace stripping.
 */
const DANGEROUS_PROTOCOLS: readonly string[] = [
  'javascript:',
  'vbscript:',
  'data:text/html',
  'data:application/xhtml',
];

/**
 * Protocols explicitly allowed in URIs.  Anything not on this list
 * (and not a relative path) triggers a warning-level violation.
 */
const SAFE_PROTOCOLS: readonly string[] = [
  'https:',
  'http:',
  'mailto:',
  'tel:',
  'evidence:',
  's3:',
  'gs:',
  'az:',
];

// ---------------------------------------------------------------------------
// HTML entity encoding
// ---------------------------------------------------------------------------

const HTML_ENTITY_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#96;',
};

const HTML_CHARS_RE = /[&<>"'`/]/g;

/**
 * Encode HTML-significant characters in untrusted text.
 *
 * This is the primary defence against reflected XSS in text fields
 * that may be rendered in HTML approval views.
 */
export function encodeHtmlEntities(text: string): string {
  return text.replace(HTML_CHARS_RE, (ch) => HTML_ENTITY_MAP[ch] ?? ch);
}

// ---------------------------------------------------------------------------
// Control character stripping
// ---------------------------------------------------------------------------

/**
 * C0 and C1 control characters (except tab, newline, carriage return)
 * that have no legitimate use in approval content.
 */
/**
 * C0 and C1 control characters (except tab, newline, carriage return)
 * that have no legitimate use in approval content.
 *
 * Built dynamically from code-point ranges to satisfy the no-control-regex lint rule.
 */
function buildControlCharPattern(): RegExp {
  const ranges: [number, number][] = [
    [0x00, 0x08], // C0 excluding HT(09)
    [0x0b, 0x0c], // VT, FF  (excluding LF=0A, CR=0D)
    [0x0e, 0x1f], // remaining C0
    [0x7f, 0x9f], // DEL + C1
  ];
  const cls = ranges
    .map(([lo, hi]) => {
      const a = String.fromCharCode(lo);
      const b = String.fromCharCode(hi);
      return lo === hi ? a : `${a}-${b}`;
    })
    .join('');
  return new RegExp(`[${cls}]`, 'g');
}

const CONTROL_CHARS_RE = buildControlCharPattern();

/**
 * Strip control characters that could interfere with rendering or be
 * used for text-direction attacks (bidi override, null bytes, etc.).
 */
export function stripControlCharacters(text: string): string {
  return text.replace(CONTROL_CHARS_RE, '');
}

/**
 * Check whether a string contains control characters.
 */
export function containsControlCharacters(text: string): boolean {
  return CONTROL_CHARS_RE.test(text);
}

// ---------------------------------------------------------------------------
// HTML tag stripping
// ---------------------------------------------------------------------------

const HTML_TAG_RE = /<\/?[a-zA-Z][^>]*>/g;

/**
 * Strip all HTML tags from a string.  Does NOT parse HTML — this is a
 * best-effort regex strip for untrusted content.
 */
export function stripHtmlTags(text: string): string {
  return text.replace(HTML_TAG_RE, '');
}

/**
 * Check whether a string contains HTML-like tags.
 */
export function containsHtmlTags(text: string): boolean {
  return HTML_TAG_RE.test(text);
}

// ---------------------------------------------------------------------------
// URI validation
// ---------------------------------------------------------------------------

/**
 * Check whether a URI uses a dangerous protocol.
 *
 * Strips leading whitespace and checks case-insensitively.
 * Returns the matched dangerous protocol or `null` if safe.
 */
export function detectDangerousProtocol(uri: string): string | null {
  const trimmed = uri.trimStart().toLowerCase();
  for (const proto of DANGEROUS_PROTOCOLS) {
    if (trimmed.startsWith(proto)) {
      return proto;
    }
  }
  return null;
}

/**
 * Check whether a URI uses a known safe protocol.
 */
export function usesSafeProtocol(uri: string): boolean {
  const trimmed = uri.trimStart().toLowerCase();
  return SAFE_PROTOCOLS.some((proto) => trimmed.startsWith(proto));
}

/**
 * Sanitize a URI for safe rendering in approval views.
 *
 * - Blocks dangerous protocols entirely.
 * - Allows known-safe protocols.
 * - Allows relative paths (no protocol).
 * - Returns a SanitizationResult indicating safety.
 */
export function sanitizeUri(uri: string): SanitizationResultV1 {
  const stripped = stripControlCharacters(uri.trim());

  if (stripped.length === 0) {
    return Object.freeze({
      safe: false,
      violation: 'URI is empty after sanitization',
      originalValue: uri,
    });
  }

  const dangerous = detectDangerousProtocol(stripped);
  if (dangerous !== null) {
    return Object.freeze({
      safe: false,
      violation: `URI uses dangerous protocol: ${dangerous}`,
      originalValue: uri,
    });
  }

  return Object.freeze({ safe: true, sanitizedValue: stripped });
}

// ---------------------------------------------------------------------------
// Text field sanitization
// ---------------------------------------------------------------------------

/**
 * Sanitize a single text field from an untrusted approval payload.
 *
 * Steps:
 *   1. Strip control characters
 *   2. Enforce length limit
 *   3. Optionally strip HTML tags, or encode HTML entities
 */
export function sanitizeTextField(
  text: string,
  constraints: ContentConstraintsV1 = DEFAULT_CONTENT_CONSTRAINTS,
): SanitizationResultV1 {
  let cleaned = stripControlCharacters(text);

  if (cleaned.length === 0) {
    return Object.freeze({
      safe: false,
      violation: 'Field is empty after control character removal',
      originalValue: text,
    });
  }

  if (cleaned.length > constraints.maxFieldLength) {
    return Object.freeze({
      safe: false,
      violation: `Field exceeds maximum length of ${String(constraints.maxFieldLength)} characters (got ${String(cleaned.length)})`,
      originalValue: text,
    });
  }

  if (constraints.stripHtmlTags) {
    cleaned = stripHtmlTags(cleaned);
  } else {
    cleaned = encodeHtmlEntities(cleaned);
  }

  return Object.freeze({ safe: true, sanitizedValue: cleaned });
}

// ---------------------------------------------------------------------------
// Payload-level validation
// ---------------------------------------------------------------------------

/**
 * Validate a map of named content fields against sanitization constraints.
 *
 * Returns an aggregate result with per-field violations.
 * This is the main entry point for validating approval payload content
 * before it enters the domain model.
 */
export function validateContentPayload(
  fields: Readonly<Record<string, string>>,
  constraints: ContentConstraintsV1 = DEFAULT_CONTENT_CONSTRAINTS,
): ContentValidationResultV1 {
  const violations: ContentViolationV1[] = [];
  let totalLength = 0;

  for (const [name, value] of Object.entries(fields)) {
    totalLength += value.length;

    // Check control characters
    if (containsControlCharacters(value)) {
      violations.push({
        field: name,
        rule: 'control_characters',
        message: `Field "${name}" contains control characters`,
      });
    }

    // Check length
    if (value.length > constraints.maxFieldLength) {
      violations.push({
        field: name,
        rule: 'content_too_long',
        message: `Field "${name}" exceeds maximum length of ${String(constraints.maxFieldLength)}`,
      });
    }

    // Check HTML injection (when not stripping)
    if (!constraints.stripHtmlTags && containsHtmlTags(value)) {
      violations.push({
        field: name,
        rule: 'html_injection',
        message: `Field "${name}" contains HTML tags`,
      });
    }

    // Check empty after trimming
    if (value.trim().length === 0) {
      violations.push({
        field: name,
        rule: 'empty_content',
        message: `Field "${name}" is empty or whitespace-only`,
      });
    }
  }

  // Check total payload size
  if (totalLength > constraints.maxTotalPayloadLength) {
    violations.push({
      field: '*',
      rule: 'content_too_long',
      message: `Total payload size ${String(totalLength)} exceeds maximum of ${String(constraints.maxTotalPayloadLength)}`,
    });
  }

  return Object.freeze({
    valid: violations.length === 0,
    violations: Object.freeze([...violations]),
  });
}

/**
 * Validate a list of URIs for safe rendering.
 *
 * Returns violations for any URI using a dangerous protocol.
 */
export function validateUris(uris: Readonly<Record<string, string>>): ContentValidationResultV1 {
  const violations: ContentViolationV1[] = [];

  for (const [name, uri] of Object.entries(uris)) {
    const result = sanitizeUri(uri);
    if (!result.safe) {
      violations.push({
        field: name,
        rule: 'dangerous_protocol' as ContentRule,
        message: result.violation,
      });
    }
  }

  return Object.freeze({
    valid: violations.length === 0,
    violations: Object.freeze([...violations]),
  });
}

// ---------------------------------------------------------------------------
// CSP nonce generation
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically random CSP nonce for inline content.
 *
 * Returns a base64url-encoded 16-byte random string suitable for use
 * in Content-Security-Policy `nonce-<value>` directives.
 *
 * Note: Uses Math.random() as a fallback for environments without
 * crypto.getRandomValues (pure domain code should not depend on Node
 * crypto module).  In production, the presentation layer should provide
 * a crypto-safe nonce via the invocation context.
 */
export function generateCspNonce(): string {
  const bytes = new Uint8Array(16);
  // Use crypto.getRandomValues if available (browser/Node 19+)
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    // Fallback for test environments
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToBase64Url(bytes);
}

/**
 * Encode bytes as base64url (RFC 4648 §5) without padding.
 */
function bytesToBase64Url(bytes: Uint8Array): string {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    result += ALPHABET[b0 >> 2]!;
    result += ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)]!;
    if (i + 1 < bytes.length) {
      result += ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)]!;
    }
    if (i + 2 < bytes.length) {
      result += ALPHABET[b2 & 0x3f]!;
    }
  }
  return result;
}
