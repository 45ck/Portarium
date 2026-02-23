/**
 * Minimal type stub for the `hono` HTTP framework.
 * The pnpm-linked node_modules in this environment is missing dist/types/index.d.ts.
 * This stub provides the subset used in this codebase (control-plane handler).
 */
declare module 'hono' {
  export type Env = { Variables: Record<string, unknown>; Bindings: Record<string, unknown> };
  export type Next = () => Promise<void>;

  export type Context<E extends Env = Env> = {
    req: {
      header(name: string): string | undefined;
      json<T = unknown>(): Promise<T>;
      query(name: string): string | undefined;
      param(name: string): string | undefined;
      url: string;
      method: string;
      path: string;
      routePath: string;
    };
    env: E['Bindings'];
    json(body: unknown, status?: number): Response;
    text(body: string, status?: number): Response;
    status(code: number): void;
    body(data: BodyInit | null, status?: number): Response;
    get<K extends keyof E['Variables']>(key: K): E['Variables'][K];
    get<T = unknown>(key: string): T;
    set<K extends keyof E['Variables']>(key: K, value: E['Variables'][K]): void;
    set(key: string, value: unknown): void;
    var: E['Variables'];
  };

  export type Handler<E extends Env = Env> = (
    c: Context<E>,
    next: Next,
  ) => Promise<Response | void> | Response | void;
  export type MiddlewareHandler<E extends Env = Env> = (c: Context<E>, next: Next) => Promise<void>;

  export class Hono<E extends Env = Env> {
    get(path: string, ...handlers: Handler<E>[]): this;
    post(path: string, ...handlers: Handler<E>[]): this;
    put(path: string, ...handlers: Handler<E>[]): this;
    patch(path: string, ...handlers: Handler<E>[]): this;
    delete(path: string, ...handlers: Handler<E>[]): this;
    use(path: string, ...handlers: MiddlewareHandler<E>[]): this;
    use(...handlers: MiddlewareHandler<E>[]): this;
    route(path: string, app: Hono<E>): this;
    fetch(request: Request, env?: Record<string, unknown>): Promise<Response>;
    request(path: string, options?: RequestInit): Promise<Response>;
    basePath(path: string): Hono<E>;
    notFound(handler: Handler<E>): this;
    onError(handler: (err: Error, c: Context<E>) => Response | Promise<Response>): this;
  }
  export default Hono;
}

declare module 'hono/cors' {
  import { MiddlewareHandler } from 'hono';
  export function cors(options?: Record<string, unknown>): MiddlewareHandler;
}

declare module 'hono/logger' {
  import { MiddlewareHandler } from 'hono';
  export function logger(fn?: (message: string, ...args: string[]) => void): MiddlewareHandler;
}

declare module 'hono/pretty-json' {
  import { MiddlewareHandler } from 'hono';
  export function prettyJSON(options?: Record<string, unknown>): MiddlewareHandler;
}

declare module 'hono/bearer-auth' {
  import { MiddlewareHandler } from 'hono';
  export function bearerAuth(options: { token: string | string[]; [key: string]: unknown }): MiddlewareHandler;
}
