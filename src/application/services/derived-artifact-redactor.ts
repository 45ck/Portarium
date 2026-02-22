/**
 * Derived-artifact redactor — strips secrets from evidence text and metadata
 * before projection into external indices (embeddings, semantic search, graphs).
 *
 * This module is pure (no I/O, no side-effects) and lives in the application
 * layer so the projector can use it without importing infrastructure.
 *
 * Redaction scope:
 *   - Text: Bearer tokens, AWS key patterns, PEM blocks, URL credentials
 *   - Metadata: all values whose key matches a sensitive-name pattern
 *     (authorization, token, secret, password, api_key, credential)
 *
 * The replacement sentinel is `[REDACTED]` — stable and clearly machine-inserted.
 */

// ---------------------------------------------------------------------------
// Text redaction patterns
// ---------------------------------------------------------------------------

type RedactionRule = Readonly<{ name: string; pattern: RegExp; replacement: string }>;

const TEXT_REDACTION_RULES: readonly RedactionRule[] = [
  // Bearer / Basic tokens in Authorization-style headers
  {
    name: 'bearer-token',
    pattern: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
    replacement: 'Bearer [REDACTED]',
  },
  {
    name: 'basic-auth-header',
    pattern: /\bBasic\s+[A-Za-z0-9+/]+=*/gi,
    replacement: 'Basic [REDACTED]',
  },

  // AWS access key IDs (static prefix AKIA/ASIA/AROA…)
  {
    name: 'aws-access-key-id',
    pattern: /\b(?:AKIA|ASIA|AROA|AIPA|ANPA|ANVA|APKA)[A-Z0-9]{16}\b/g,
    replacement: '[REDACTED-AWS-KEY]',
  },

  // AWS secret access key heuristic (40-char base64 following "aws_secret")
  {
    name: 'aws-secret-key',
    pattern: /aws_secret[_a-z]*["\s:=]+[A-Za-z0-9+/]{40}/gi,
    replacement: 'aws_secret_access_key=[REDACTED]',
  },

  // PEM private key blocks
  {
    name: 'pem-private-key',
    pattern:
      /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/gi,
    replacement: '[REDACTED-PRIVATE-KEY]',
  },

  // URL credentials: scheme://user:password@host
  {
    name: 'url-credentials',
    pattern: /([a-z][a-z0-9+\-.]*:\/\/)([^:@/?#\s]+:[^@/?#\s]+)(@)/gi,
    replacement: '$1[REDACTED]$3',
  },

  // GitHub personal access tokens (classic: ghp_, fine-grained: github_pat_)
  {
    name: 'github-pat',
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}/g,
    replacement: '[REDACTED-GH-TOKEN]',
  },

  // Generic API key assignment patterns: api_key = "…", "apiKey": "…"
  {
    name: 'generic-api-key-assignment',
    pattern: /(?:api[-_]?key|apikey)\s*[=:]\s*["']?[A-Za-z0-9\-._~]{16,}["']?/gi,
    replacement: '[REDACTED-API-KEY]',
  },
];

/**
 * Redacts secrets from a plain-text evidence string before it is embedded
 * or indexed in an external system.
 *
 * Returns the redacted string. The function is deterministic — applying it
 * multiple times yields the same result.
 */
export function redactEvidenceText(text: string): string {
  let result = text;
  for (const rule of TEXT_REDACTION_RULES) {
    result = result.replace(rule.pattern, rule.replacement);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Metadata redaction patterns
// ---------------------------------------------------------------------------

const SENSITIVE_METADATA_KEY =
  /(authorization|token|secret|password|api[-_]?key|credential|private[-_]?key|passphrase)/i;

/**
 * Redacts values from a metadata object whose keys match sensitive patterns.
 * Nested objects are recursively redacted.
 *
 * Returns a new object; the input is not mutated.
 */
export function redactMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return redactValue(metadata) as Record<string, unknown>;
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_METADATA_KEY.test(key) ? '[REDACTED]' : redactValue(nested);
    }
    return out;
  }
  return value;
}
