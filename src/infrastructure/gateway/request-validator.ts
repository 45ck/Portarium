/**
 * Lightweight request shape validator for the Agent Gateway.
 *
 * Validates that inbound requests have the minimum required structure before
 * proxying to the control plane. This is not a full OpenAPI schema validator --
 * the control plane performs authoritative validation. The gateway performs
 * "fast-fail" checks to reject obviously malformed requests early.
 */

export type RequestValidationResult =
  | Readonly<{ valid: true }>
  | Readonly<{ valid: false; reason: string }>;

export type ValidatableRequest = Readonly<{
  method: string;
  path: string;
  contentType?: string;
  bodySize?: number;
  body?: unknown;
}>;

export type RequestValidatorConfig = Readonly<{
  /** Maximum request body size in bytes. Defaults to 1 MiB. */
  maxBodyBytes?: number;
  /** Allowed HTTP methods. Defaults to GET, POST, PUT, PATCH, DELETE. */
  allowedMethods?: readonly string[];
}>;

const DEFAULT_MAX_BODY_BYTES = 1_048_576; // 1 MiB
const DEFAULT_ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

function invalid(reason: string): RequestValidationResult {
  return { valid: false, reason };
}

function validateMethod(method: string, allowedMethods: readonly string[]): RequestValidationResult {
  const normalizedMethod = method.toUpperCase();
  return allowedMethods.includes(normalizedMethod)
    ? { valid: true }
    : invalid(`Method ${normalizedMethod} is not allowed.`);
}

function validatePath(path: string): RequestValidationResult {
  return path.startsWith('/') ? { valid: true } : invalid('Request path must start with /.');
}

function validateBodySize(
  bodySize: number | undefined,
  maxBodyBytes: number,
): RequestValidationResult {
  if (bodySize === undefined || bodySize <= maxBodyBytes) return { valid: true };
  return invalid(`Request body exceeds maximum size of ${maxBodyBytes} bytes.`);
}

function requiresJsonBody(method: string): boolean {
  return method === 'POST' || method === 'PUT' || method === 'PATCH';
}

function isSupportedContentType(contentType: string): boolean {
  const normalized = contentType.toLowerCase();
  return (
    normalized.includes('application/json') || normalized.includes('application/cloudevents+json')
  );
}

function validateContentType(
  method: string,
  contentType: string | undefined,
): RequestValidationResult {
  if (!requiresJsonBody(method) || contentType === undefined) return { valid: true };
  return isSupportedContentType(contentType)
    ? { valid: true }
    : invalid(`Unsupported content type: ${contentType}. Expected application/json.`);
}

export function validateRequest(
  request: ValidatableRequest,
  config?: RequestValidatorConfig,
): RequestValidationResult {
  const maxBodyBytes = config?.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const allowedMethods = config?.allowedMethods ?? DEFAULT_ALLOWED_METHODS;
  const method = request.method.toUpperCase();
  const checks = [
    validateMethod(method, allowedMethods),
    validatePath(request.path),
    validateBodySize(request.bodySize, maxBodyBytes),
    validateContentType(method, request.contentType),
  ];
  return checks.find((result) => !result.valid) ?? { valid: true };
}
