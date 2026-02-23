/**
 * Minimal type stub for @aws-sdk/client-s3.
 * The pnpm-linked node_modules in this environment is missing dist-types/index.d.ts.
 * This stub provides the subset used in the S3 WORM evidence store.
 */
declare module '@aws-sdk/client-s3' {
  export interface S3ClientConfig {
    region?: string;
    endpoint?: string;
    credentials?: {
      accessKeyId: string;
      secretAccessKey: string;
      sessionToken?: string;
    };
    forcePathStyle?: boolean;
    [key: string]: unknown;
  }

  export class S3Client {
    constructor(config?: S3ClientConfig);
    send<Input extends object, _Output extends object>(
      command: Command<Input, _Output>,
    ): Promise<_Output>;
    destroy(): void;
  }

  export abstract class Command<Input extends object, _Output extends object> {
    readonly input: Input;
    constructor(input: Input);
  }

  export interface PutObjectCommandInput {
    Bucket: string;
    Key: string;
    Body?: Buffer | Uint8Array | string;
    ContentType?: string;
    Metadata?: Record<string, string>;
    ServerSideEncryption?: string;
    ObjectLockMode?: string;
    ObjectLockRetainUntilDate?: Date;
    [key: string]: unknown;
  }

  export interface PutObjectCommandOutput {
    ETag?: string;
    VersionId?: string;
    $metadata: { httpStatusCode?: number };
  }

  export class PutObjectCommand extends Command<PutObjectCommandInput, PutObjectCommandOutput> {
    constructor(input: PutObjectCommandInput);
  }

  export interface GetObjectCommandInput {
    Bucket: string;
    Key: string;
    [key: string]: unknown;
  }

  export interface GetObjectCommandOutput {
    Body?: {
      transformToString(encoding?: string): Promise<string>;
      transformToByteArray(): Promise<Uint8Array>;
    };
    ContentType?: string;
    $metadata: { httpStatusCode?: number };
  }

  export class GetObjectCommand extends Command<GetObjectCommandInput, GetObjectCommandOutput> {
    constructor(input: GetObjectCommandInput);
  }

  export interface HeadObjectCommandInput {
    Bucket: string;
    Key: string;
    [key: string]: unknown;
  }

  export interface HeadObjectCommandOutput {
    ContentType?: string;
    ContentLength?: number;
    Metadata?: Record<string, string>;
    $metadata: { httpStatusCode?: number };
  }

  export class HeadObjectCommand extends Command<HeadObjectCommandInput, HeadObjectCommandOutput> {
    constructor(input: HeadObjectCommandInput);
  }

  export interface DeleteObjectCommandInput {
    Bucket: string;
    Key: string;
    [key: string]: unknown;
  }

  export interface DeleteObjectCommandOutput {
    $metadata: { httpStatusCode?: number };
  }

  export class DeleteObjectCommand extends Command<
    DeleteObjectCommandInput,
    DeleteObjectCommandOutput
  > {
    constructor(input: DeleteObjectCommandInput);
  }

  export interface PutObjectLegalHoldCommandInput {
    Bucket: string;
    Key: string;
    LegalHold: { Status: 'ON' | 'OFF' };
    VersionId?: string;
    [key: string]: unknown;
  }
  export interface PutObjectLegalHoldCommandOutput {
    $metadata: { httpStatusCode?: number };
  }
  export class PutObjectLegalHoldCommand extends Command<
    PutObjectLegalHoldCommandInput,
    PutObjectLegalHoldCommandOutput
  > {
    constructor(input: PutObjectLegalHoldCommandInput);
  }

  export interface PutObjectRetentionCommandInput {
    Bucket: string;
    Key: string;
    Retention: { Mode: 'GOVERNANCE' | 'COMPLIANCE'; RetainUntilDate: Date };
    VersionId?: string;
    BypassGovernanceRetention?: boolean;
    [key: string]: unknown;
  }
  export interface PutObjectRetentionCommandOutput {
    $metadata: { httpStatusCode?: number };
  }
  export class PutObjectRetentionCommand extends Command<
    PutObjectRetentionCommandInput,
    PutObjectRetentionCommandOutput
  > {
    constructor(input: PutObjectRetentionCommandInput);
  }

  export class NoSuchKey extends Error {
    readonly name: 'NoSuchKey';
  }
  export class S3ServiceException extends Error {
    readonly $fault: 'client' | 'server';
    readonly $metadata: { httpStatusCode?: number };
  }
}
