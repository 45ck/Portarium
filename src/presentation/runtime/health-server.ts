import http, { type IncomingMessage, type Server, type ServerResponse } from 'node:http';

export type HealthServerOptions = Readonly<{
  role: string;
  host?: string;
  port: number;
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

function isHealthPath(url: string | undefined): boolean {
  return url === '/healthz' || url === '/readyz' || url === '/ready' || url === '/health';
}

function createHandler(role: string, startedAt: string) {
  return (req: IncomingMessage, res: ServerResponse) => {
    if (isHealthPath(req.url)) {
      respondJson(res, 200, { service: role, status: 'ok', startedAt });
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

  const server = http.createServer(createHandler(role, startedAt));
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
