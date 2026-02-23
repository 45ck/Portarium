/**
 * Minimal React type declaration stub for the root workspace TypeScript build.
 *
 * The root tsconfig includes tests that import cockpit hooks (e.g.
 * map-performance-budget.test.ts imports use-virtual-robot-list.ts which
 * imports useMemo from 'react'). The root workspace does not install @types/react
 * because it is not a React project; cockpit handles its own React types.
 *
 * This stub satisfies the root-level TypeScript compiler without polluting
 * the cockpit app's React types.
 */
declare module 'react' {
  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  export function useCallback<T extends (...args: unknown[]) => unknown>(
    callback: T,
    deps: readonly unknown[],
  ): T;
  export function useState<T>(initialState: T | (() => T)): [T, (value: T | ((prev: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useRef<T>(initialValue: T): { current: T };
  export function useRef<T = undefined>(): { current: T | undefined };
  export function useContext<T>(context: unknown): T;
  export function createContext<T>(defaultValue: T): unknown;
  export type FC<P = Record<string, unknown>> = (props: P) => unknown;
  export type ReactNode = unknown;
  export type ReactElement = unknown;
  export type Dispatch<A> = (action: A) => void;
  export type SetStateAction<S> = S | ((prev: S) => S);
  export type RefObject<T> = { readonly current: T | null };
  export type MutableRefObject<T> = { current: T };
  export default unknown;
}
