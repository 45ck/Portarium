import { describe, expect, it } from 'vitest';
import { Readable } from 'node:stream';
import type { IncomingMessage } from 'node:http';

import { PayloadTooLargeError, readJsonBody } from './control-plane-handler.shared.js';

/**
 * Create a fake IncomingMessage-like readable stream from a Buffer or string.
 * Sets Content-Type to application/json by default.
 */
function fakeReq(
  body: string | Buffer,
  headers: Record<string, string> = { 'content-type': 'application/json' },
): IncomingMessage {
  const buf = typeof body === 'string' ? Buffer.from(body, 'utf8') : body;
  const stream = new Readable({
    read() {
      this.push(buf);
      this.push(null);
    },
  });
  (stream as unknown as IncomingMessage).headers = headers;
  return stream as unknown as IncomingMessage;
}

function emptyReq(): IncomingMessage {
  const stream = new Readable({
    read() {
      this.push(null);
    },
  });
  (stream as unknown as IncomingMessage).headers = {};
  return stream as unknown as IncomingMessage;
}

// ---------------------------------------------------------------------------
// readJsonBody — discriminated union result
// ---------------------------------------------------------------------------

describe('readJsonBody', () => {
  it('parses valid JSON', async () => {
    const result = await readJsonBody(fakeReq('{"key":"value"}'));
    expect(result).toEqual({ ok: true, value: { key: 'value' } });
  });

  it('returns empty-body error for empty body', async () => {
    const result = await readJsonBody(emptyReq());
    expect(result).toEqual({ ok: false, error: 'empty-body' });
  });

  it('returns empty-body error for whitespace-only body', async () => {
    const result = await readJsonBody(fakeReq('   '));
    expect(result).toEqual({ ok: false, error: 'empty-body' });
  });

  it('returns invalid-json error for malformed JSON', async () => {
    const result = await readJsonBody(fakeReq('not json'));
    expect(result).toEqual({ ok: false, error: 'invalid-json' });
  });

  it('parses arrays', async () => {
    const result = await readJsonBody(fakeReq('[1,2,3]'));
    expect(result).toEqual({ ok: true, value: [1, 2, 3] });
  });

  it('returns unsupported-content-type when Content-Type is not application/json', async () => {
    const result = await readJsonBody(fakeReq('{"key":"value"}', { 'content-type': 'text/plain' }));
    expect(result).toEqual({ ok: false, error: 'unsupported-content-type' });
  });

  it('returns unsupported-content-type when Content-Type is missing but body is present', async () => {
    const result = await readJsonBody(fakeReq('{"key":"value"}', {}));
    expect(result).toEqual({ ok: false, error: 'unsupported-content-type' });
  });

  it('accepts application/json with charset parameter', async () => {
    const result = await readJsonBody(
      fakeReq('{"key":"value"}', { 'content-type': 'application/json; charset=utf-8' }),
    );
    expect(result).toEqual({ ok: true, value: { key: 'value' } });
  });
});

// ---------------------------------------------------------------------------
// Body size limit enforcement
// ---------------------------------------------------------------------------

describe('readJsonBody size limit', () => {
  it('accepts a body within the limit', async () => {
    const payload = JSON.stringify({ data: 'x'.repeat(100) });
    const result = await readJsonBody(fakeReq(payload), 1024);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ data: 'x'.repeat(100) });
  });

  it('throws PayloadTooLargeError when body exceeds limit', async () => {
    const payload = JSON.stringify({ data: 'x'.repeat(200) });
    await expect(readJsonBody(fakeReq(payload), 50)).rejects.toThrow(PayloadTooLargeError);
  });

  it('PayloadTooLargeError includes maxBytes', async () => {
    const payload = 'x'.repeat(100);
    try {
      await readJsonBody(fakeReq(payload), 50);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PayloadTooLargeError);
      expect((err as PayloadTooLargeError).maxBytes).toBe(50);
    }
  });

  it('accepts body exactly at the limit', async () => {
    const payload = '{"a":1}'; // 7 bytes
    const result = await readJsonBody(fakeReq(payload), 7);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ a: 1 });
  });

  it('rejects body one byte over the limit', async () => {
    const payload = '{"a":1}'; // 7 bytes
    await expect(readJsonBody(fakeReq(payload), 6)).rejects.toThrow(PayloadTooLargeError);
  });

  it('uses default limit (1 MiB) when no limit specified', async () => {
    // A body under 1 MiB should succeed with default limit
    const payload = JSON.stringify({ data: 'x'.repeat(1000) });
    const result = await readJsonBody(fakeReq(payload));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveProperty('data');
  });

  it('rejects multi-chunk bodies that cumulatively exceed the limit', async () => {
    // Create a stream that sends multiple small chunks
    const chunkSize = 30;
    const numChunks = 5; // 150 bytes total
    const limit = 100;
    let chunksSent = 0;

    const stream = new Readable({
      read() {
        if (chunksSent < numChunks) {
          this.push(Buffer.alloc(chunkSize, 0x41)); // 'A' bytes
          chunksSent++;
        } else {
          this.push(null);
        }
      },
    });
    (stream as unknown as IncomingMessage).headers = { 'content-type': 'application/json' };

    await expect(readJsonBody(stream as unknown as IncomingMessage, limit)).rejects.toThrow(
      PayloadTooLargeError,
    );
  });
});

// ---------------------------------------------------------------------------
// PayloadTooLargeError class
// ---------------------------------------------------------------------------

describe('PayloadTooLargeError', () => {
  it('has correct name', () => {
    const err = new PayloadTooLargeError(1024);
    expect(err.name).toBe('PayloadTooLargeError');
  });

  it('includes limit in message', () => {
    const err = new PayloadTooLargeError(1024);
    expect(err.message).toContain('1024');
  });

  it('is an instance of Error', () => {
    const err = new PayloadTooLargeError(1024);
    expect(err).toBeInstanceOf(Error);
  });
});
