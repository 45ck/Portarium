import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

import { WorkspaceRbacAuthorization } from '../../application/iam/rbac/workspace-rbac-authorization.js';
import type { AuthenticationPort, AuthorizationPort, RunStore, WorkspaceStore } from '../../application/ports/index.js';
import type { AppContext } from '../../application/common/context.js';
import type { Forbidden, NotFound, Unauthorized, ValidationFailed } from '../../application/common/errors.js';
import { err } from '../../application/common/result.js';
import { getRun } from '../../application/queries/get-run.js';
import { getWorkspace } from '../../application/queries/get-workspace.js';
import { JoseJwtAuthentication } from '../../infrastructure/auth/jose-jwt-authentication.js';
import type { RequestHandler } from './health-server.js';

type ProblemDetails = Readonly<{
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}>;

type QueryError = Unauthorized | Forbidden | NotFound | ValidationFailed;

type ControlPlaneDeps = Readonly<{
  authentication: AuthenticationPort;
  authorization: AuthorizationPort;
  workspaceStore: WorkspaceStore;
  runStore: RunStore;
}>;

function normalizeHeader(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

function readAuthorizationHeader(req: IncomingMessage): string | undefined {
  const value = normalizeHeader(req.headers.authorization);
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function normalizeCorrelationId(req: IncomingMessage): string {
  const value = normalizeHeader(req.headers['x-correlation-id']);
  if (value && value.trim() !== '') return value.trim();
  return randomUUID();
}

function respondJson(res: ServerResponse, statusCode: number, correlationId: string, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json');
  res.setHeader('x-correlation-id', correlationId);
  res.end(JSON.stringify(body));
}

function respondProblem(res: ServerResponse, problem: ProblemDetails, correlationId: string): void {
  res.statusCode = problem.status;
  res.setHeader('content-type', 'application/problem+json');
  res.setHeader('x-correlation-id', correlationId);
  res.end(JSON.stringify(problem));
}

function problemFromError(error: QueryError, instance: string): ProblemDetails {
  switch (error.kind) {
    case 'Unauthorized':
      return {
        type: 'https://portarium.dev/problems/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: error.message,
        instance,
      };
    case 'Forbidden':
      return {
        type: 'https://portarium.dev/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: error.message,
        instance,
      };
    case 'NotFound':
      return {
        type: 'https://portarium.dev/problems/not-found',
        title: 'Not Found',
        status: 404,
        detail: error.message,
        instance,
      };
    case 'ValidationFailed':
      return {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 400,
        detail: error.message,
        instance,
      };
  }
}

function buildAuthentication(): AuthenticationPort {
  const jwksUri = process.env['PORTARIUM_JWKS_URI']?.trim();
  const issuer = process.env['PORTARIUM_JWT_ISSUER']?.trim();
  const audience = process.env['PORTARIUM_JWT_AUDIENCE']?.trim();

  if (jwksUri) {
    return new JoseJwtAuthentication({
      jwksUri,
      issuer: issuer && issuer !== '' ? issuer : undefined,
      audience: audience && audience !== '' ? audience : undefined,
    });
  }

  // Keep the container runnable without auth config; protected routes return 401.
  return {
    authenticateBearerToken: ({ correlationId }) =>
      Promise.resolve(
        err({ kind: 'Unauthorized', message: `Authentication not configured. (${correlationId})` }),
      ),
  };
}

function buildDeps(): ControlPlaneDeps {
  const authentication = buildAuthentication();
  const authorization: AuthorizationPort = new WorkspaceRbacAuthorization();

  // TODO(beads): replace with real persistence adapters (DB).
  const workspaceStore: WorkspaceStore = {
    getWorkspaceById: () => Promise.resolve(null),
    saveWorkspace: () => Promise.resolve(),
  };
  const runStore: RunStore = {
    getRunById: () => Promise.resolve(null),
    saveRun: () => Promise.resolve(),
  };

  return { authentication, authorization, workspaceStore, runStore };
}

async function authenticate(
  deps: ControlPlaneDeps,
  req: IncomingMessage,
  correlationId: string,
  expectedWorkspaceId: string | undefined,
): Promise<{ ok: true; ctx: AppContext } | { ok: false; error: Unauthorized }> {
  const auth = await deps.authentication.authenticateBearerToken({
    authorizationHeader: readAuthorizationHeader(req),
    correlationId,
    expectedWorkspaceId,
  });

  if (auth.ok) return { ok: true, ctx: auth.value };
  return { ok: false, error: auth.error };
}

async function handleGetWorkspace(
  args: Readonly<{
    deps: ControlPlaneDeps;
    req: IncomingMessage;
    res: ServerResponse;
    correlationId: string;
    pathname: string;
    workspaceId: string;
  }>,
): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId } = args;

  const auth = await authenticate(deps, req, correlationId, workspaceId);
  if (!auth.ok) {
    respondProblem(res, problemFromError(auth.error, pathname), correlationId);
    return;
  }

  const result = await getWorkspace(
    { authorization: deps.authorization, workspaceStore: deps.workspaceStore },
    auth.ctx,
    { workspaceId },
  );

  if (result.ok) {
    respondJson(res, 200, correlationId, result.value);
    return;
  }

  respondProblem(res, problemFromError(result.error, pathname), correlationId);
}

async function handleGetRun(
  args: Readonly<{
    deps: ControlPlaneDeps;
    req: IncomingMessage;
    res: ServerResponse;
    correlationId: string;
    pathname: string;
    workspaceId: string;
    runId: string;
  }>,
): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, runId } = args;

  const auth = await authenticate(deps, req, correlationId, workspaceId);
  if (!auth.ok) {
    respondProblem(res, problemFromError(auth.error, pathname), correlationId);
    return;
  }

  const result = await getRun(
    { authorization: deps.authorization, runStore: deps.runStore },
    auth.ctx,
    { workspaceId, runId },
  );

  if (result.ok) {
    respondJson(res, 200, correlationId, result.value);
    return;
  }

  respondProblem(res, problemFromError(result.error, pathname), correlationId);
}

async function handleRequest(deps: ControlPlaneDeps, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const correlationId = normalizeCorrelationId(req);
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;

  if (req.method === 'GET') {
    const mWorkspace = /^\/v1\/workspaces\/([^/]+)$/.exec(pathname);
    if (mWorkspace) {
      await handleGetWorkspace({
        deps,
        req,
        res,
        correlationId,
        pathname,
        workspaceId: decodeURIComponent(mWorkspace[1] ?? ''),
      });
      return;
    }

    const mRun = /^\/v1\/workspaces\/([^/]+)\/runs\/([^/]+)$/.exec(pathname);
    if (mRun) {
      await handleGetRun({
        deps,
        req,
        res,
        correlationId,
        pathname,
        workspaceId: decodeURIComponent(mRun[1] ?? ''),
        runId: decodeURIComponent(mRun[2] ?? ''),
      });
      return;
    }
  }

  respondProblem(
    res,
    {
      type: 'https://portarium.dev/problems/not-found',
      title: 'Not Found',
      status: 404,
      detail: 'Route not found.',
      instance: pathname,
    },
    correlationId,
  );
}

export function createControlPlaneHandler(deps: ControlPlaneDeps = buildDeps()): RequestHandler {
  return (req, res) => {
    void handleRequest(deps, req, res).catch((error) => {
      const correlationId = randomUUID();
      respondProblem(
        res,
        {
          type: 'https://portarium.dev/problems/internal',
          title: 'Internal Server Error',
          status: 500,
          detail: error instanceof Error ? error.message : 'Unhandled error.',
          instance: req.url ?? '/',
        },
        correlationId,
      );
    });
  };
}
