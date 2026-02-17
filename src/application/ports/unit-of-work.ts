export interface UnitOfWork {
  execute<T>(fn: () => Promise<T>): Promise<T>;
}
