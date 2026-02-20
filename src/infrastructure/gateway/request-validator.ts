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

export function validateRequest(
  request: ValidatableRequest,
  config?: RequestValidatorConfig,
): RequestValidationResult {
  const maxBodyBytes = config?.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const allowedMethods = config?.allowedMethods ?? DEFAULT_ALLOWED_METHODS;

  const method = request.method.toUpperCase();
  if (!allowedMethods.includes(method)) {
    return { valid: false, reason: `Method ${method} is not allowed.` };
  }

  if (!request.path.startsWith('/')) {
    return { valid: false, reason: 'Request path must start with /.' };
  }

  if (request.bodySize !== undefined && request.bodySize > maxBodyBytes) {
    return {
      valid: false,
      reason: `Request body exceeds maximum size of ${maxBodyBytes} bytes.`,
    };
  }

  const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH';
  if (hasBody && request.contentType !== undefined) {
    const ct = request.contentType.toLowerCase();
    if (!ct.includes('application/json') && !ct.includes('application/cloudevents+json')) {
      return {
        valid: false,
        reason: `Unsupported content type: ${request.contentType}. Expected application/json.`,
      };
    }
  }

  return { valid: true };
}
