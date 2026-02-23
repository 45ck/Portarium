/**
 * Minimal type stubs for ajv and ajv/dist/2020.
 * The pnpm-linked node_modules in this environment is missing dist/ajv.d.ts.
 * This stub provides the subset used in this codebase.
 */
declare module 'ajv' {
  interface AjvOptions {
    strict?: boolean;
    allErrors?: boolean;
    [key: string]: unknown;
  }
  interface ValidateFunction<T = unknown> {
    (data: unknown): data is T;
    errors?: { message?: string; instancePath?: string }[] | null;
  }
  class Ajv {
    constructor(options?: AjvOptions);
    compile<T = unknown>(schema: object): ValidateFunction<T>;
    validate(schema: object | string, data: unknown): boolean;
    addSchema(schema: object, key?: string): this;
    addFormat(name: string, format: { validate: (data: string) => boolean } | RegExp): this;
    addKeyword(definition: Record<string, unknown>): this;
    errors?: { message?: string; instancePath?: string }[] | null;
  }
  export { ValidateFunction, AjvOptions };
  export = Ajv;
  export default Ajv;
}

declare module 'ajv/dist/2020.js' {
  import Ajv from 'ajv';
  class Ajv2020 extends Ajv {}
  export { Ajv2020 };
  export = Ajv2020;
  export default Ajv2020;
}

declare module 'ajv/dist/2020' {
  import Ajv from 'ajv';
  export = Ajv;
  export default Ajv;
}

declare module 'ajv-formats' {
  function addFormats(ajv: unknown, options?: unknown): unknown;
  export = addFormats;
  export default addFormats;
}
