import http, { type IncomingMessage, type Server, type ServerResponse } from 'node:http';

export type RequestHandler = (req: IncomingMessage, res: ServerResponse) => void;

/** Result of a single dependency check. */
export type HealthCheckResult = Readonly<{
  ok: boolean;
  message?: string;
}>;

/** Aggregated readiness probe result. */
export type ReadinessResult = Readonly<{
  ok: boolean;
  checks: Readonly<Record<string, HealthCheckResult>>;
}>;

export type HealthServerOptions = Readonly<{
  role: string;
  host?: string;
  port: number;
  /** Optional handler for non-health paths. When omitted, a plain text response is returned. */
  handler?: RequestHandler;
  /** Optional readiness check. When provided, /readyz and /ready run dependency checks. */
  readinessCheck?: () => Promise<ReadinessResult>;
}>;

export type HealthServerHandle = Readonly<{
  role: string;
  host: string;
  port: number;
  startedAt: string;
  server: Server;
  close: () => Promise<void>;
}>;

function respondJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

function respondText(res: ServerResponse, statusCode: number, body: string): void {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.end(body);
}

function isLivenessPath(url: string | undefined): boolean {
  return url === '/healthz' || url === '/health' || url === '/livez';
}

function isReadinessPath(url: string | undefined): boolean {
  return url === '/readyz' || url === '/ready';
}

function createHandler(
  role: string,
  startedAt: string,
  handler?: RequestHandler,
  readinessCheck?: () => Promise<ReadinessResult>,
) {
  return (req: IncomingMessage, res: ServerResponse) => {
    if (isLivenessPath(req.url)) {
      respondJson(res, 200, { service: role, status: 'ok', startedAt });
      return;
    }

    if (isReadinessPath(req.url)) {
      if (!readinessCheck) {
        respondJson(res, 200, { service: role, status: 'ok', startedAt });
        return;
      }
      void readinessCheck().then(
        (result) => {
          const statusCode = result.ok ? 200 : 503;
          respondJson(res, statusCode, {
            service: role,
            status: result.ok ? 'ok' : 'unavailable',
            startedAt,
            checks: result.checks,
          });
        },
        () => {
          respondJson(res, 503, {
            service: role,
            status: 'unavailable',
            startedAt,
            checks: { readinessCheck: { ok: false, message: 'Readiness check threw' } },
          });
        },
      );
      return;
    }

    if (handler) {
      handler(req, res);
      return;
    }

    respondText(res, 200, `Portarium ${role} runtime`);
  };
}

function listen(server: Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
  });
}

export async function startHealthServer(options: HealthServerOptions): Promise<HealthServerHandle> {
  const role = options.role;
  const host = options.host ?? '0.0.0.0';
  const startedAt = new Date().toISOString();

  const server = http.createServer(
    createHandler(role, startedAt, options.handler, options.readinessCheck),
  );
  await listen(server, options.port, host);

  const address = server.address();
  const boundPort = typeof address === 'object' && address ? address.port : options.port;

  return {
    role,
    host,
    port: boundPort,
    startedAt,
    server,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      }),
  };
}
