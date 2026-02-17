import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const providerId = 'stripe';
const specPath = path.join(
  repoRoot,
  'domain-atlas',
  'upstreams',
  providerId,
  'latest',
  'openapi.spec3.json',
);
const sourceManifestPath = path.join(
  repoRoot,
  'domain-atlas',
  'sources',
  providerId,
  'source.json',
);
const outPath = path.join(repoRoot, 'domain-atlas', 'extracted', providerId, 'cif.json');

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${path.relative(repoRoot, filePath)}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function nowIsoUtc() {
  return new Date().toISOString();
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function pascalCase(value) {
  return String(value)
    .split(/[^a-zA-Z0-9]+/g)
    .filter((p) => p.length > 0)
    .map((p) => p.slice(0, 1).toUpperCase() + p.slice(1))
    .join('');
}

function refNameFromRef(ref) {
  const m = /^#\/components\/schemas\/(.+)$/.exec(String(ref));
  if (!m) return null;
  return m[1];
}

function pickMeaningfulSchema(schema) {
  if (!schema || typeof schema !== 'object') return null;
  if (typeof schema.$ref === 'string') return schema;
  if (typeof schema.type === 'string') return schema;

  const variants = Array.isArray(schema.anyOf)
    ? schema.anyOf
    : Array.isArray(schema.oneOf)
      ? schema.oneOf
      : [];
  for (const v of variants) {
    if (!v || typeof v !== 'object') continue;
    if (typeof v.$ref === 'string') return v;
    if (
      typeof v.type === 'string' &&
      !(v.type === 'string' && Array.isArray(v.enum) && v.enum.length === 1)
    ) {
      return v;
    }
  }

  return schema;
}

function fieldTypeFromSchema(schema) {
  const picked = pickMeaningfulSchema(schema);
  if (!picked || typeof picked !== 'object') return 'unknown';

  if (typeof picked.$ref === 'string') {
    const refName = refNameFromRef(picked.$ref);
    return refName ? pascalCase(refName) : 'ref';
  }

  if (Array.isArray(picked.enum)) return 'enum';

  if (picked.type === 'array') {
    const items = picked.items ? fieldTypeFromSchema(picked.items) : 'unknown';
    return `array<${items}>`;
  }

  if (picked.type === 'integer' && picked.format === 'unix-time') return 'unix_timestamp';
  if (picked.type === 'string' && picked.format === 'currency') return 'currency_code';

  return picked.type ?? 'unknown';
}

function isNullable(schema) {
  const picked = pickMeaningfulSchema(schema);
  return Boolean(picked && typeof picked === 'object' && picked.nullable === true);
}

function extractEntity(spec, schemaName, fieldAllowlist, entityNameOverride) {
  const schema = spec?.components?.schemas?.[schemaName];
  if (!schema || typeof schema !== 'object') {
    throw new Error(`Missing schema "${schemaName}" in Stripe OpenAPI components.schemas`);
  }

  const entityName = isNonEmptyString(entityNameOverride)
    ? entityNameOverride.trim()
    : pascalCase(schemaName);
  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  const properties =
    schema.properties && typeof schema.properties === 'object' ? schema.properties : {};

  const fields = [];
  for (const fieldName of fieldAllowlist) {
    const prop = properties[fieldName];
    if (!prop) continue;

    fields.push({
      name: fieldName,
      type: fieldTypeFromSchema(prop),
      required: required.has(fieldName),
      nullable: isNullable(prop) ? true : undefined,
      description: typeof prop.description === 'string' ? prop.description : undefined,
    });
  }

  if (fields.length === 0) {
    throw new Error(
      `No fields extracted for entity "${entityName}" (${schemaName}). Check allowlist.`,
    );
  }

  const entity = {
    name: entityName,
    description: typeof schema.description === 'string' ? schema.description : undefined,
    primaryKeys: fields.some((f) => f.name === 'id') ? ['id'] : undefined,
    fields,
  };

  // Remove undefined keys to keep diffs tight.
  return JSON.parse(JSON.stringify(entity));
}

function extractLifecycle(spec, schemaName, statusField = 'status') {
  const schema = spec?.components?.schemas?.[schemaName];
  const statusSchema = schema?.properties?.[statusField];
  const picked = pickMeaningfulSchema(statusSchema);
  const states = Array.isArray(picked?.enum) ? picked.enum : null;
  if (!states || states.length === 0) return null;

  return {
    entity: pascalCase(schemaName),
    statusField,
    states,
    notes: 'States derived from OpenAPI enum values.',
  };
}

function main() {
  const spec = readJson(specPath);
  const sourceManifest = readJson(sourceManifestPath);

  const commit =
    typeof sourceManifest?.upstream?.commit === 'string' &&
    sourceManifest.upstream.commit.trim().length > 0
      ? sourceManifest.upstream.commit.trim()
      : undefined;

  const entitiesToExtract = [
    {
      schema: 'customer',
      fields: ['id', 'object', 'created', 'email', 'name', 'phone', 'description', 'metadata'],
    },
    {
      schema: 'invoice',
      fields: [
        'id',
        'object',
        'created',
        'customer',
        'status',
        'currency',
        'subtotal',
        'total',
        'hosted_invoice_url',
        'subscription',
      ],
    },
    {
      schema: 'invoiceitem',
      entityName: 'InvoiceItem',
      fields: [
        'id',
        'object',
        'created',
        'customer',
        'invoice',
        'amount',
        'currency',
        'description',
      ],
    },
    {
      schema: 'payment_intent',
      fields: [
        'id',
        'object',
        'created',
        'amount',
        'amount_received',
        'currency',
        'status',
        'customer',
        'payment_method',
        'description',
      ],
    },
    {
      schema: 'charge',
      fields: [
        'id',
        'object',
        'created',
        'amount',
        'amount_refunded',
        'currency',
        'status',
        'customer',
        'payment_intent',
        'refunded',
        'paid',
        'captured',
      ],
    },
    {
      schema: 'refund',
      fields: [
        'id',
        'object',
        'created',
        'amount',
        'currency',
        'status',
        'charge',
        'payment_intent',
        'reason',
      ],
    },
    {
      schema: 'balance_transaction',
      fields: ['id', 'object', 'created', 'amount', 'currency', 'fee', 'net', 'type', 'source'],
    },
    {
      schema: 'payout',
      fields: [
        'id',
        'object',
        'created',
        'amount',
        'currency',
        'status',
        'arrival_date',
        'statement_descriptor',
      ],
    },
    {
      schema: 'dispute',
      fields: ['id', 'object', 'created', 'amount', 'currency', 'status', 'charge', 'reason'],
    },
    {
      schema: 'subscription',
      fields: [
        'id',
        'object',
        'created',
        'customer',
        'status',
        'current_period_start',
        'current_period_end',
        'cancel_at_period_end',
      ],
    },
    {
      schema: 'subscription_item',
      fields: ['id', 'object', 'created', 'subscription', 'price', 'quantity'],
    },
    {
      schema: 'product',
      fields: ['id', 'object', 'created', 'name', 'active', 'description', 'metadata'],
    },
    {
      schema: 'price',
      fields: [
        'id',
        'object',
        'created',
        'active',
        'currency',
        'unit_amount',
        'product',
        'recurring',
        'type',
      ],
    },
    {
      schema: 'payment_method',
      fields: ['id', 'object', 'created', 'type', 'customer', 'billing_details', 'metadata'],
    },
  ];

  const entities = entitiesToExtract.map((e) =>
    extractEntity(spec, e.schema, e.fields, e.entityName),
  );

  const lifecycles = [
    extractLifecycle(spec, 'invoice', 'status'),
    extractLifecycle(spec, 'payment_intent', 'status'),
    extractLifecycle(spec, 'charge', 'status'),
    extractLifecycle(spec, 'subscription', 'status'),
    extractLifecycle(spec, 'dispute', 'status'),
  ].filter(Boolean);

  const cif = {
    schemaVersion: '1.0.0',
    source: {
      providerId,
      providerName: 'Stripe',
      upstream: {
        repoUrl: 'https://github.com/stripe/openapi',
        commit,
        version: 'pinned-by-commit',
      },
    },
    extractedAt: nowIsoUtc(),
    entities,
    relationships: [
      {
        fromEntity: 'Invoice',
        toEntity: 'Customer',
        kind: 'many_to_one',
        fromField: 'customer',
        toField: 'id',
      },
      {
        fromEntity: 'PaymentIntent',
        toEntity: 'Customer',
        kind: 'many_to_one',
        fromField: 'customer',
        toField: 'id',
      },
      {
        fromEntity: 'Charge',
        toEntity: 'Customer',
        kind: 'many_to_one',
        fromField: 'customer',
        toField: 'id',
      },
      {
        fromEntity: 'Subscription',
        toEntity: 'Customer',
        kind: 'many_to_one',
        fromField: 'customer',
        toField: 'id',
      },
      {
        fromEntity: 'Refund',
        toEntity: 'Charge',
        kind: 'many_to_one',
        fromField: 'charge',
        toField: 'id',
      },
      {
        fromEntity: 'Charge',
        toEntity: 'PaymentIntent',
        kind: 'many_to_one',
        fromField: 'payment_intent',
        toField: 'id',
      },
      {
        fromEntity: 'Price',
        toEntity: 'Product',
        kind: 'many_to_one',
        fromField: 'product',
        toField: 'id',
      },
      {
        fromEntity: 'Dispute',
        toEntity: 'Charge',
        kind: 'many_to_one',
        fromField: 'charge',
        toField: 'id',
      },
      {
        fromEntity: 'SubscriptionItem',
        toEntity: 'Subscription',
        kind: 'many_to_one',
        fromField: 'subscription',
        toField: 'id',
      },
      {
        fromEntity: 'SubscriptionItem',
        toEntity: 'Price',
        kind: 'many_to_one',
        fromField: 'price',
        toField: 'id',
      },
      {
        fromEntity: 'InvoiceItem',
        toEntity: 'Invoice',
        kind: 'many_to_one',
        fromField: 'invoice',
        toField: 'id',
      },
      {
        fromEntity: 'InvoiceItem',
        toEntity: 'Customer',
        kind: 'many_to_one',
        fromField: 'customer',
        toField: 'id',
      },
    ],
    lifecycles,
    actions: [
      {
        name: 'createPaymentIntent',
        kind: 'create',
        entities: ['PaymentIntent'],
        idempotency: { supported: true, mechanism: 'Idempotency-Key header' },
      },
      {
        name: 'confirmPaymentIntent',
        kind: 'workflow',
        entities: ['PaymentIntent', 'Charge'],
        idempotency: { supported: true, mechanism: 'Idempotency-Key header' },
      },
      {
        name: 'capturePaymentIntent',
        kind: 'workflow',
        entities: ['PaymentIntent', 'Charge'],
        idempotency: { supported: true, mechanism: 'Idempotency-Key header' },
      },
      {
        name: 'cancelPaymentIntent',
        kind: 'workflow',
        entities: ['PaymentIntent'],
        idempotency: { supported: true, mechanism: 'Idempotency-Key header' },
      },
      {
        name: 'createRefund',
        kind: 'create',
        entities: ['Refund'],
        idempotency: { supported: true, mechanism: 'Idempotency-Key header' },
      },
      {
        name: 'finalizeInvoice',
        kind: 'workflow',
        entities: ['Invoice'],
        idempotency: { supported: true, mechanism: 'Idempotency-Key header' },
      },
      {
        name: 'voidInvoice',
        kind: 'workflow',
        entities: ['Invoice'],
        idempotency: { supported: true, mechanism: 'Idempotency-Key header' },
      },
      {
        name: 'createSubscription',
        kind: 'create',
        entities: ['Subscription', 'SubscriptionItem'],
        idempotency: { supported: true, mechanism: 'Idempotency-Key header' },
      },
      {
        name: 'updateSubscription',
        kind: 'update',
        entities: ['Subscription', 'SubscriptionItem'],
        idempotency: { supported: true, mechanism: 'Idempotency-Key header' },
      },
      {
        name: 'cancelSubscription',
        kind: 'workflow',
        entities: ['Subscription'],
        idempotency: { supported: true, mechanism: 'Idempotency-Key header' },
      },
    ],
    events: [
      {
        name: 'invoice.created',
        delivery: 'webhook',
        entities: ['Invoice'],
        notes: 'Example only; OpenAPI does not enumerate all Stripe event type strings.',
      },
      {
        name: 'payment_intent.succeeded',
        delivery: 'webhook',
        entities: ['PaymentIntent'],
        notes: 'Example only; OpenAPI does not enumerate all Stripe event type strings.',
      },
    ],
    extensionPoints: {
      customFields: {
        supported: false,
        notes: 'Stripe uses per-object metadata maps rather than admin-defined schema extensions.',
      },
      tags: { supported: false },
      attachments: { supported: false },
      comments: { supported: false },
      activities: { supported: false },
    },
  };

  writeJson(outPath, cif);
}

main();
