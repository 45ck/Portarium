/**
 * Kubernetes health probe HTTP server.
 *
 * Exposes three endpoints on a dedicated port (default: 8081):
 *   GET /health/live    — liveness:  is the process stuck / deadlocked?
 *   GET /health/ready   — readiness: is the process ready to accept traffic?
 *   GET /health/startup — startup:   has the process finished initialisation?
 *
 * Kubernetes will:
 *   - Restart the pod if /health/live returns non-2xx (liveness failure).
 *   - Remove the pod from Service endpoints if /health/ready returns non-2xx.
 *   - Wait for /health/startup before starting liveness/readiness checks.
 *
 * Bead: bead-0396
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

// ── Types ─────────────────────────────────────────────────────────────────

export type HealthStatus = 'ok' | 'degraded' | 'fail';

export interface HealthCheckResult {
  status: HealthStatus;
  message?: string;
  checks?: Record<string, { status: HealthStatus; message?: string }>;
}

export type HealthCheckFn = () => Promise<HealthCheckResult> | HealthCheckResult;

export interface HealthCheckServerOptions {
  /** TCP port to listen on. Default: 8081. */
  port?: number;
  /** Host to bind to. Default: '0.0.0.0'. */
  host?: string;
  /**
   * Liveness check: return fail only if the process is irrecoverably stuck.
   * Kubernetes will restart the pod on failure.
   */
  livenessCheck?: HealthCheckFn;
  /**
   * Readiness check: return fail if the service cannot handle requests yet
   * (DB not connected, cache warming, etc.). Kubernetes removes from LB.
   */
  readinessCheck?: HealthCheckFn;
  /**
   * Startup check: return fail while the service is still initialising.
   * Liveness and readiness checks are suspended until startup succeeds.
   */
  startupCheck?: HealthCheckFn;
}

// ── Defaults ───────────────────────────────────────────────────────────────

const alwaysOk: HealthCheckFn = () => ({ status: 'ok' });

// ── Server ─────────────────────────────────────────────────────────────────

export class HealthCheckServer {
  private readonly port: number;
  private readonly host: string;
  private readonly livenessCheck: HealthCheckFn;
  private readonly readinessCheck: HealthCheckFn;
  private readonly startupCheck: HealthCheckFn;
  private server: ReturnType<typeof createServer> | null = null;
  private boundPort: number | null = null;

  constructor(opts: HealthCheckServerOptions = {}) {
    this.port = opts.port ?? 8081;
    this.host = opts.host ?? '0.0.0.0';
    this.livenessCheck = opts.livenessCheck ?? alwaysOk;
    this.readinessCheck = opts.readinessCheck ?? alwaysOk;
    this.startupCheck = opts.startupCheck ?? alwaysOk;
  }

  /** The actual port the server is bound to (available after start()). */
  get actualPort(): number {
    return this.boundPort ?? this.port;
  }

  /** Start listening. Resolves when the server is bound. */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res).catch((err) => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'fail', message: String(err) }));
        });
      });

      this.server.on('error', reject);
      this.server.listen(this.port, this.host, () => {
        const addr = this.server!.address();
        this.boundPort = typeof addr === 'object' && addr !== null ? addr.port : this.port;
        resolve();
      });
    });
  }

  /** Stop the server gracefully. */
  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url ?? '/';

    let checkFn: HealthCheckFn;
    if (url === '/health/live' || url === '/healthz') {
      checkFn = this.livenessCheck;
    } else if (url === '/health/ready' || url === '/readyz') {
      checkFn = this.readinessCheck;
    } else if (url === '/health/startup' || url === '/startupz') {
      checkFn = this.startupCheck;
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }

    const result = await checkFn();
    const httpStatus = result.status === 'ok' || result.status === 'degraded' ? 200 : 503;

    res.writeHead(httpStatus, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }
}
