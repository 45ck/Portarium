import type { AppContext } from '../common/context.js';
import type { AppError } from '../common/errors.js';
import type { Result } from '../common/result.js';
import { err } from '../common/result.js';

export type QueryHandler<TInput, TOutput> = (
  ctx: AppContext,
  input: TInput,
) => Promise<Result<TOutput, AppError>>;

export class QueryBus {
  private readonly handlers = new Map<
    string,
    (ctx: AppContext, input: unknown) => Promise<Result<unknown, AppError>>
  >();

  public register<TInput, TOutput>(name: string, handler: QueryHandler<TInput, TOutput>): void {
    if (this.handlers.has(name)) {
      throw new Error(`Query handler '${name}' is already registered.`);
    }
    this.handlers.set(
      name,
      handler as (ctx: AppContext, input: unknown) => Promise<Result<unknown, AppError>>,
    );
  }

  public async execute<TInput, TOutput>(
    name: string,
    ctx: AppContext,
    input: TInput,
  ): Promise<Result<TOutput, AppError>> {
    const handler = this.handlers.get(name);
    if (!handler) {
      return err({
        kind: 'DependencyFailure',
        message: `No handler registered for query '${name}'.`,
      });
    }

    try {
      return (await handler(ctx, input)) as Result<TOutput, AppError>;
    } catch (error) {
      return err({
        kind: 'DependencyFailure',
        message: error instanceof Error ? error.message : 'Unhandled query handler error.',
      });
    }
  }
}
