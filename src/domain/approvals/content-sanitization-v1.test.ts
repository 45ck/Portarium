import { describe, expect, it } from 'vitest';

import {
  containsControlCharacters,
  containsHtmlTags,
  DEFAULT_CONTENT_CONSTRAINTS,
  detectDangerousProtocol,
  encodeHtmlEntities,
  generateCspNonce,
  sanitizeTextField,
  sanitizeUri,
  stripControlCharacters,
  stripHtmlTags,
  usesSafeProtocol,
  validateContentPayload,
  validateUris,
} from './content-sanitization-v1.js';

// ---------------------------------------------------------------------------
// encodeHtmlEntities
// ---------------------------------------------------------------------------

describe('encodeHtmlEntities', () => {
  it('encodes all HTML-significant characters', () => {
    expect(encodeHtmlEntities('&<>"\'/`')).toBe('&amp;&lt;&gt;&quot;&#x27;&#x2F;&#96;');
  });

  it('leaves safe text unchanged', () => {
    expect(encodeHtmlEntities('Hello world 123')).toBe('Hello world 123');
  });

  it('encodes a script tag', () => {
    const input = '<script>alert("xss")</script>';
    const result = encodeHtmlEntities(input);
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('handles empty string', () => {
    expect(encodeHtmlEntities('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// stripControlCharacters / containsControlCharacters
// ---------------------------------------------------------------------------

describe('stripControlCharacters', () => {
  it('removes null bytes', () => {
    expect(stripControlCharacters('hello\x00world')).toBe('helloworld');
  });

  it('preserves tabs, newlines, and carriage returns', () => {
    expect(stripControlCharacters('a\tb\nc\r')).toBe('a\tb\nc\r');
  });

  it('removes C1 control characters', () => {
    expect(stripControlCharacters('test\x80\x9Fend')).toBe('testend');
  });

  it('returns unchanged text without control characters', () => {
    const text = 'Normal text with spaces and numbers 123';
    expect(stripControlCharacters(text)).toBe(text);
  });
});

describe('containsControlCharacters', () => {
  it('detects null byte', () => {
    expect(containsControlCharacters('abc\x00def')).toBe(true);
  });

  it('returns false for clean text', () => {
    expect(containsControlCharacters('clean text\n')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// stripHtmlTags / containsHtmlTags
// ---------------------------------------------------------------------------

describe('stripHtmlTags', () => {
  it('strips basic HTML tags', () => {
    expect(stripHtmlTags('<b>bold</b>')).toBe('bold');
  });

  it('strips self-closing tags', () => {
    expect(stripHtmlTags('before<br/>after')).toBe('beforeafter');
  });

  it('strips tags with attributes', () => {
    expect(stripHtmlTags('<a href="evil">click</a>')).toBe('click');
  });

  it('leaves text without tags unchanged', () => {
    expect(stripHtmlTags('plain text')).toBe('plain text');
  });
});

describe('containsHtmlTags', () => {
  it('detects script tag', () => {
    expect(containsHtmlTags('<script>alert(1)</script>')).toBe(true);
  });

  it('returns false for plain text', () => {
    expect(containsHtmlTags('no tags here')).toBe(false);
  });

  it('detects self-closing tag', () => {
    expect(containsHtmlTags('text<br/>more')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// detectDangerousProtocol / usesSafeProtocol
// ---------------------------------------------------------------------------

describe('detectDangerousProtocol', () => {
  it('detects javascript: protocol', () => {
    expect(detectDangerousProtocol('javascript:alert(1)')).toBe('javascript:');
  });

  it('detects javascript: with leading whitespace', () => {
    expect(detectDangerousProtocol('  javascript:void(0)')).toBe('javascript:');
  });

  it('detects case-insensitive javascript:', () => {
    expect(detectDangerousProtocol('JAVASCRIPT:alert(1)')).toBe('javascript:');
  });

  it('detects vbscript: protocol', () => {
    expect(detectDangerousProtocol('vbscript:MsgBox("hi")')).toBe('vbscript:');
  });

  it('detects data:text/html', () => {
    expect(detectDangerousProtocol('data:text/html,<script>x</script>')).toBe('data:text/html');
  });

  it('returns null for https:', () => {
    expect(detectDangerousProtocol('https://example.com')).toBeNull();
  });

  it('returns null for relative paths', () => {
    expect(detectDangerousProtocol('/api/v1/resource')).toBeNull();
  });
});

describe('usesSafeProtocol', () => {
  it('accepts https:', () => {
    expect(usesSafeProtocol('https://example.com')).toBe(true);
  });

  it('accepts http:', () => {
    expect(usesSafeProtocol('http://localhost')).toBe(true);
  });

  it('accepts evidence: protocol', () => {
    expect(usesSafeProtocol('evidence://snapshots/123')).toBe(true);
  });

  it('accepts s3: protocol', () => {
    expect(usesSafeProtocol('s3://bucket/key')).toBe(true);
  });

  it('rejects javascript:', () => {
    expect(usesSafeProtocol('javascript:void(0)')).toBe(false);
  });

  it('rejects relative paths', () => {
    expect(usesSafeProtocol('/relative/path')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sanitizeUri
// ---------------------------------------------------------------------------

describe('sanitizeUri', () => {
  it('accepts safe https URI', () => {
    const r = sanitizeUri('https://example.com/path');
    expect(r.safe).toBe(true);
    if (r.safe) expect(r.sanitizedValue).toBe('https://example.com/path');
  });

  it('rejects javascript: URI', () => {
    const r = sanitizeUri('javascript:alert(1)');
    expect(r.safe).toBe(false);
    if (!r.safe) {
      expect(r.violation).toContain('dangerous protocol');
      expect(r.originalValue).toBe('javascript:alert(1)');
    }
  });

  it('rejects empty URI', () => {
    const r = sanitizeUri('  ');
    expect(r.safe).toBe(false);
  });

  it('strips control characters from URI', () => {
    const r = sanitizeUri('https://example.com/\x00path');
    expect(r.safe).toBe(true);
    if (r.safe) expect(r.sanitizedValue).toBe('https://example.com/path');
  });

  it('returns frozen result', () => {
    const r = sanitizeUri('https://safe.example.com');
    expect(Object.isFrozen(r)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// sanitizeTextField
// ---------------------------------------------------------------------------

describe('sanitizeTextField', () => {
  it('encodes HTML in text by default', () => {
    const r = sanitizeTextField('<script>alert(1)</script>');
    expect(r.safe).toBe(true);
    if (r.safe) {
      expect(r.sanitizedValue).not.toContain('<script>');
      expect(r.sanitizedValue).toContain('&lt;script&gt;');
    }
  });

  it('strips HTML tags when configured', () => {
    const r = sanitizeTextField('<b>bold</b>', {
      ...DEFAULT_CONTENT_CONSTRAINTS,
      stripHtmlTags: true,
    });
    expect(r.safe).toBe(true);
    if (r.safe) expect(r.sanitizedValue).toBe('bold');
  });

  it('rejects text exceeding max field length', () => {
    const longText = 'a'.repeat(10_001);
    const r = sanitizeTextField(longText);
    expect(r.safe).toBe(false);
    if (!r.safe) expect(r.violation).toContain('exceeds maximum length');
  });

  it('accepts text within max field length', () => {
    const text = 'a'.repeat(10_000);
    const r = sanitizeTextField(text);
    expect(r.safe).toBe(true);
  });

  it('rejects text that becomes empty after control char removal', () => {
    const r = sanitizeTextField('\x00\x01\x02');
    expect(r.safe).toBe(false);
    if (!r.safe) expect(r.violation).toContain('empty');
  });

  it('strips control characters from text', () => {
    const r = sanitizeTextField('hello\x00world');
    expect(r.safe).toBe(true);
    if (r.safe) expect(r.sanitizedValue).toContain('helloworld');
  });

  it('returns frozen result', () => {
    const r = sanitizeTextField('test');
    expect(Object.isFrozen(r)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateContentPayload
// ---------------------------------------------------------------------------

describe('validateContentPayload', () => {
  it('accepts clean fields', () => {
    const r = validateContentPayload({
      title: 'Deploy v2.3 to production',
      description: 'Routine deployment of the latest release.',
    });
    expect(r.valid).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it('detects control characters', () => {
    const r = validateContentPayload({ name: 'test\x00value' });
    expect(r.valid).toBe(false);
    expect(r.violations).toContainEqual(
      expect.objectContaining({ field: 'name', rule: 'control_characters' }),
    );
  });

  it('detects HTML tags when stripHtmlTags is false', () => {
    const r = validateContentPayload({ body: '<script>alert(1)</script>' });
    expect(r.valid).toBe(false);
    expect(r.violations).toContainEqual(
      expect.objectContaining({ field: 'body', rule: 'html_injection' }),
    );
  });

  it('does not flag HTML tags when stripHtmlTags is true', () => {
    const r = validateContentPayload(
      { body: '<b>bold</b>' },
      {
        ...DEFAULT_CONTENT_CONSTRAINTS,
        stripHtmlTags: true,
      },
    );
    const htmlViolations = r.violations.filter((v) => v.rule === 'html_injection');
    expect(htmlViolations).toHaveLength(0);
  });

  it('detects field exceeding max length', () => {
    const r = validateContentPayload(
      { huge: 'x'.repeat(11_000) },
      { ...DEFAULT_CONTENT_CONSTRAINTS, maxFieldLength: 10_000 },
    );
    expect(r.valid).toBe(false);
    expect(r.violations).toContainEqual(
      expect.objectContaining({ field: 'huge', rule: 'content_too_long' }),
    );
  });

  it('detects total payload exceeding max', () => {
    const r = validateContentPayload(
      { a: 'x'.repeat(60_000), b: 'y'.repeat(60_000) },
      { ...DEFAULT_CONTENT_CONSTRAINTS, maxTotalPayloadLength: 100_000 },
    );
    expect(r.valid).toBe(false);
    expect(r.violations).toContainEqual(
      expect.objectContaining({ field: '*', rule: 'content_too_long' }),
    );
  });

  it('detects whitespace-only fields', () => {
    const r = validateContentPayload({ empty: '   ' });
    expect(r.valid).toBe(false);
    expect(r.violations).toContainEqual(
      expect.objectContaining({ field: 'empty', rule: 'empty_content' }),
    );
  });

  it('collects multiple violations across fields', () => {
    const r = validateContentPayload({
      a: '\x00bad',
      b: '<script>x</script>',
    });
    expect(r.violations.length).toBeGreaterThanOrEqual(2);
  });

  it('returns frozen result', () => {
    const r = validateContentPayload({ ok: 'fine' });
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.violations)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateUris
// ---------------------------------------------------------------------------

describe('validateUris', () => {
  it('accepts safe URIs', () => {
    const r = validateUris({
      docs: 'https://example.com/docs',
      evidence: 'evidence://snapshots/abc',
    });
    expect(r.valid).toBe(true);
  });

  it('rejects javascript: URI', () => {
    const r = validateUris({ link: 'javascript:alert(1)' });
    expect(r.valid).toBe(false);
    expect(r.violations).toContainEqual(
      expect.objectContaining({ field: 'link', rule: 'dangerous_protocol' }),
    );
  });

  it('rejects data:text/html URI', () => {
    const r = validateUris({ payload: 'data:text/html,<h1>hi</h1>' });
    expect(r.valid).toBe(false);
  });

  it('accepts relative URIs', () => {
    const r = validateUris({ api: '/api/v1/resource' });
    expect(r.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateCspNonce
// ---------------------------------------------------------------------------

describe('generateCspNonce', () => {
  it('returns a non-empty string', () => {
    const nonce = generateCspNonce();
    expect(nonce.length).toBeGreaterThan(0);
  });

  it('returns only base64url characters', () => {
    const nonce = generateCspNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('generates unique values on successive calls', () => {
    const a = generateCspNonce();
    const b = generateCspNonce();
    expect(a).not.toBe(b);
  });

  it('returns a string of consistent length', () => {
    // 16 bytes → ceil(16*4/3) = 22 base64url chars (no padding)
    const nonce = generateCspNonce();
    expect(nonce.length).toBe(22);
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_CONTENT_CONSTRAINTS
// ---------------------------------------------------------------------------

describe('DEFAULT_CONTENT_CONSTRAINTS', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(DEFAULT_CONTENT_CONSTRAINTS)).toBe(true);
  });

  it('has sensible defaults', () => {
    expect(DEFAULT_CONTENT_CONSTRAINTS.maxFieldLength).toBe(10_000);
    expect(DEFAULT_CONTENT_CONSTRAINTS.maxTotalPayloadLength).toBe(100_000);
    expect(DEFAULT_CONTENT_CONSTRAINTS.stripHtmlTags).toBe(false);
  });
});
