import type { AppContext } from '../common/context.js';
import type { AppError } from '../common/errors.js';
import { err } from '../common/result.js';
import type { Result } from '../common/result.js';

export type CommandHandler<TInput, TOutput> = (
  ctx: AppContext,
  input: TInput,
) => Promise<Result<TOutput, AppError>>;

export class CommandBus {
  private readonly handlers = new Map<
    string,
    (ctx: AppContext, input: unknown) => Promise<Result<unknown, AppError>>
  >();

  public register<TInput, TOutput>(name: string, handler: CommandHandler<TInput, TOutput>): void {
    if (this.handlers.has(name)) {
      throw new Error(`Command handler '${name}' is already registered.`);
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
        message: `No handler registered for command '${name}'.`,
      });
    }

    try {
      return (await handler(ctx, input)) as Result<TOutput, AppError>;
    } catch (error) {
      return err({
        kind: 'DependencyFailure',
        message: error instanceof Error ? error.message : 'Unhandled command handler error.',
      });
    }
  }
}
