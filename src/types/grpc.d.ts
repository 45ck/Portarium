/**
 * Minimal type stubs for @grpc/grpc-js and @grpc/proto-loader.
 * The pnpm-linked node_modules in this environment is missing build/src/index.d.ts
 * for @grpc/grpc-js. This stub provides the subset used in this codebase.
 */
declare module '@grpc/grpc-js' {
  export class Channel {
    constructor(address: string, credentials: ChannelCredentials, options: Record<string, unknown>);
  }
  export abstract class ChannelCredentials {
    static createInsecure(): ChannelCredentials;
    static createSsl(
      rootCerts?: Buffer | null,
      privateKey?: Buffer | null,
      certChain?: Buffer | null,
    ): ChannelCredentials;
  }
  export class Client {
    constructor(
      address: string,
      credentials: ChannelCredentials,
      options?: Record<string, unknown>,
    );
    close(): void;
    getChannel(): Channel;
    waitForReady(deadline: Date | number, callback: (error: Error | undefined) => void): void;
    makeUnaryRequest<Req, Res>(
      method: string,
      serialize: (value: Req) => Buffer,
      deserialize: (value: Buffer) => Res,
      argument: Req,
      callback: UnaryCallback<Res>,
    ): ClientUnaryCall;
    makeServerStreamRequest<Req, Res>(
      method: string,
      serialize: (value: Req) => Buffer,
      deserialize: (value: Buffer) => Res,
      argument: Req,
    ): ClientReadableStream<Res>;
  }
  export interface ClientUnaryCall {
    cancel(): void;
  }
  export interface ClientReadableStream<T> {
    on(event: 'data', listener: (chunk: T) => void): this;
    on(event: 'end', listener: () => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    cancel(): void;
  }
  export type UnaryCallback<T> = (error: ServiceError | null, value: T | null) => void;
  export interface ServiceError extends Error {
    code: number;
    details: string;
    metadata: Metadata;
  }
  export class Metadata {
    add(key: string, value: string | Buffer): void;
    get(key: string): (string | Buffer)[];
    set(key: string, value: string | Buffer): void;
    remove(key: string): void;
    toJSON(): Record<string, string[]>;
  }
  export const status: Record<string, number>;
  export const credentials: {
    createInsecure(): ChannelCredentials;
    createSsl(
      rootCerts?: Buffer | null,
      privateKey?: Buffer | null,
      certChain?: Buffer | null,
    ): ChannelCredentials;
    combineChannelCredentials(
      channelCredentials: ChannelCredentials,
      ...callCredentials: CallCredentials[]
    ): ChannelCredentials;
    createFromMetadataGenerator(
      metadataGenerator: (
        options: { service_url: string },
        callback: (error: Error | null, metadata?: Metadata) => void,
      ) => void,
    ): CallCredentials;
  };
  export abstract class CallCredentials {}
  export function makeGenericClientConstructor(
    methods: Record<string, unknown>,
    serviceName: string,
    classOptions?: Record<string, unknown>,
  ): new (
    address: string,
    credentials: ChannelCredentials,
    options?: Record<string, unknown>,
  ) => Client;
  export function loadPackageDefinition(packageDef: unknown): Record<string, unknown>;
}

declare module '@grpc/proto-loader' {
  export type PackageDefinition = Record<string, unknown>;
  export interface Options {
    keepCase?: boolean;
    longs?: unknown;
    enums?: unknown;
    bytes?: unknown;
    defaults?: boolean;
    arrays?: boolean;
    objects?: boolean;
    oneofs?: boolean;
    includeDirs?: string[];
  }
  export function loadSync(filename: string | string[], options?: Options): PackageDefinition;
  export function load(filename: string | string[], options?: Options): Promise<PackageDefinition>;
}
