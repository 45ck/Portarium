type SalesforceErrorBody = Readonly<{
  errorCode?: string;
  message?: string;
  fields?: readonly string[];
}>;

type SalesforceErrorResponse = readonly SalesforceErrorBody[];

type SalesforceHttpErrorResult = Readonly<{
  ok: false;
  error: 'not_found' | 'validation_error' | 'provider_error';
  message: string;
}>;

export function parseSalesforceErrorResponse(body: unknown): SalesforceErrorResponse | null {
  if (!Array.isArray(body)) return null;
  return body as SalesforceErrorResponse;
}

export function mapSalesforceHttpError(status: number, body: unknown): SalesforceHttpErrorResult {
  const errors = parseSalesforceErrorResponse(body);
  const firstMessage = errors?.[0]?.message ?? 'Unknown Salesforce error';
  const firstCode = errors?.[0]?.errorCode ?? '';

  if (status === 404 || firstCode === 'NOT_FOUND') {
    return { ok: false, error: 'not_found', message: firstMessage };
  }

  if (
    status === 400 ||
    firstCode === 'REQUIRED_FIELD_MISSING' ||
    firstCode === 'INVALID_FIELD' ||
    firstCode === 'MALFORMED_ID' ||
    firstCode === 'FIELD_CUSTOM_VALIDATION_EXCEPTION' ||
    firstCode === 'STRING_TOO_LONG'
  ) {
    return { ok: false, error: 'validation_error', message: firstMessage };
  }

  return { ok: false, error: 'provider_error', message: `Salesforce ${status}: ${firstMessage}` };
}
