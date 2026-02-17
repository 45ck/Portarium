import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const providerId = 'killbill';

const upstreamRoot = path.join(repoRoot, 'domain-atlas', 'upstreams', providerId);
const sourceManifestPath = path.join(
  repoRoot,
  'domain-atlas',
  'sources',
  providerId,
  'source.json',
);
const outPath = path.join(repoRoot, 'domain-atlas', 'extracted', providerId, 'cif.json');

const jaxrsJsonRoot = path.join(
  upstreamRoot,
  'jaxrs',
  'src',
  'main',
  'java',
  'org',
  'killbill',
  'billing',
  'jaxrs',
  'json',
);

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${path.relative(repoRoot, filePath)}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${path.relative(repoRoot, filePath)}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function nowIsoUtc() {
  return new Date().toISOString();
}

function relPosix(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

function stripComments(text) {
  // Good enough for extracting field declarations; avoids brace counting noise in comments.
  const withoutBlock = text.replaceAll(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlock.replaceAll(/\/\/.*$/gm, '');
}

function countChar(str, ch) {
  let n = 0;
  for (let i = 0; i < str.length; i += 1) {
    if (str[i] === ch) n += 1;
  }
  return n;
}

function isEnumLike(javaType) {
  const t = javaType.trim();
  return (
    t.endsWith('Status') ||
    t.endsWith('Type') ||
    t === 'EntitlementState' ||
    t === 'InvoiceStatus' ||
    t === 'InvoiceItemType' ||
    t === 'TransactionType' ||
    t === 'TransactionStatus' ||
    t === 'ProductCategory' ||
    t === 'BillingPeriod' ||
    t === 'PhaseType'
  );
}

function normalizeJavaType(javaTypeRaw) {
  const javaType = String(javaTypeRaw).replaceAll(/\s+/g, ' ').trim();

  const listMatch = /^List<(.+)>$/.exec(javaType);
  if (listMatch) {
    let inner = listMatch[1].trim();
    inner = inner.replace(/^(\? extends|\? super)\s+/, '');
    return `array<${normalizeJavaType(inner)}>`;
  }

  if (javaType === 'UUID') return 'uuid';
  if (javaType === 'String') return 'string';
  if (javaType === 'Integer' || javaType === 'int' || javaType === 'Long' || javaType === 'long')
    return 'integer';
  if (javaType === 'Boolean' || javaType === 'boolean') return 'boolean';
  if (javaType === 'BigDecimal') return 'decimal';
  if (javaType === 'Currency') return 'currency_code';
  if (javaType === 'DateTime') return 'datetime';
  if (javaType === 'LocalDate') return 'date';
  if (isEnumLike(javaType)) return 'enum';

  // Preserve unknown types (often other JSON DTOs) so CIF stays informative.
  return javaType;
}

function extractFieldsFromJavaFile(filePath, outerClassName) {
  const raw = readText(filePath);
  const text = stripComments(raw);

  const lines = text.split(/\r?\n/g);

  const classRe = new RegExp(`\\bclass\\s+${outerClassName}\\b`);
  let inClass = false;
  let depth = 0;

  let nextFieldRequired = false;
  const fields = [];

  for (const line of lines) {
    if (!inClass) {
      if (!classRe.test(line)) continue;
      inClass = true;
    }

    // After we see the outer class, we start counting braces.
    depth += countChar(line, '{');
    depth -= countChar(line, '}');

    if (depth !== 1) {
      // Only capture top-level field declarations.
      continue;
    }

    if (/@ApiModelProperty\b/.test(line) && /required\s*=\s*true/.test(line)) {
      nextFieldRequired = true;
      continue;
    }

    // Example:
    //   private final UUID accountId;
    //   private List<InvoiceItemJson> childItems;
    const m =
      /^\s*private\s+(?!static\b)(?:final\s+)?(?<type>[A-Za-z0-9_<>?,.\s]+?)\s+(?<name>[A-Za-z0-9_]+)\s*;/.exec(
        line,
      );
    if (!m?.groups) continue;

    const javaType = m.groups.type.trim();
    const name = m.groups.name.trim();

    fields.push({
      name,
      type: normalizeJavaType(javaType),
      required: nextFieldRequired,
    });
    nextFieldRequired = false;
  }

  if (fields.length === 0) {
    throw new Error(`No fields extracted from ${relPosix(filePath)} for class ${outerClassName}`);
  }

  return fields;
}

function extractEntity({ entityName, javaFile, primaryKey }) {
  const filePath = path.join(jaxrsJsonRoot, javaFile);
  const outerClassName = path.basename(javaFile, '.java');

  const fields = extractFieldsFromJavaFile(filePath, outerClassName);

  return {
    name: entityName,
    description: `Extracted from ${relPosix(filePath)}.`,
    primaryKeys: [primaryKey],
    fields,
  };
}

const ENTITY_SPECS = [
  { entityName: 'Account', javaFile: 'AccountJson.java', primaryKey: 'accountId' },
  { entityName: 'Bundle', javaFile: 'BundleJson.java', primaryKey: 'bundleId' },
  { entityName: 'Subscription', javaFile: 'SubscriptionJson.java', primaryKey: 'subscriptionId' },
  { entityName: 'Invoice', javaFile: 'InvoiceJson.java', primaryKey: 'invoiceId' },
  { entityName: 'InvoiceItem', javaFile: 'InvoiceItemJson.java', primaryKey: 'invoiceItemId' },
  { entityName: 'Payment', javaFile: 'PaymentJson.java', primaryKey: 'paymentId' },
  {
    entityName: 'PaymentTransaction',
    javaFile: 'PaymentTransactionJson.java',
    primaryKey: 'transactionId',
  },
];

const RELATIONSHIPS = [
  {
    fromEntity: 'Invoice',
    toEntity: 'Account',
    kind: 'many_to_one',
    fromField: 'accountId',
    toField: 'accountId',
  },
  {
    fromEntity: 'Payment',
    toEntity: 'Account',
    kind: 'many_to_one',
    fromField: 'accountId',
    toField: 'accountId',
  },
  {
    fromEntity: 'Bundle',
    toEntity: 'Account',
    kind: 'many_to_one',
    fromField: 'accountId',
    toField: 'accountId',
  },
  {
    fromEntity: 'Subscription',
    toEntity: 'Account',
    kind: 'many_to_one',
    fromField: 'accountId',
    toField: 'accountId',
  },
  {
    fromEntity: 'Subscription',
    toEntity: 'Bundle',
    kind: 'many_to_one',
    fromField: 'bundleId',
    toField: 'bundleId',
  },
  {
    fromEntity: 'InvoiceItem',
    toEntity: 'Invoice',
    kind: 'many_to_one',
    fromField: 'invoiceId',
    toField: 'invoiceId',
  },
  {
    fromEntity: 'PaymentTransaction',
    toEntity: 'Payment',
    kind: 'many_to_one',
    fromField: 'paymentId',
    toField: 'paymentId',
  },
];

const LIFECYCLES = [
  {
    entity: 'Invoice',
    statusField: 'status',
    states: ['DRAFT', 'COMMITTED', 'VOID'],
    notes:
      'InvoiceStatus states derived from usage in Kill Bill server code (InvoiceStatus.DRAFT/COMMITTED/VOID).',
  },
  {
    entity: 'Subscription',
    statusField: 'state',
    states: ['PENDING', 'ACTIVE', 'BLOCKED', 'CANCELLED', 'EXPIRED'],
    notes:
      'EntitlementState values derived from usage in Kill Bill server code (ACTIVE/BLOCKED/CANCELLED/EXPIRED/PENDING).',
  },
  {
    entity: 'PaymentTransaction',
    statusField: 'status',
    states: [
      'PENDING',
      'SUCCESS',
      'PAYMENT_FAILURE',
      'PAYMENT_SYSTEM_OFF',
      'PLUGIN_FAILURE',
      'UNKNOWN',
    ],
    notes:
      'TransactionStatus values derived from usage in Kill Bill server code (PENDING/SUCCESS/PAYMENT_FAILURE/PAYMENT_SYSTEM_OFF/PLUGIN_FAILURE/UNKNOWN).',
  },
];

const ACTIONS = [
  {
    name: 'createAccount',
    kind: 'create',
    entities: ['Account'],
    idempotency: {
      supported: true,
      mechanism: 'Account externalKey (body)',
      notes: 'Adapter should de-dupe on externalKey.',
    },
  },
  {
    name: 'updateAccount',
    kind: 'update',
    entities: ['Account'],
    idempotency: {
      supported: true,
      mechanism: 'Account ID (path)',
      notes: 'PUT/PATCH semantics are deterministic per ID.',
    },
  },
  {
    name: 'createSubscription',
    kind: 'create',
    entities: ['Subscription', 'Bundle'],
    idempotency: {
      supported: true,
      mechanism: 'Subscription/bundle external keys (body)',
      notes: 'Kill Bill supports external keys for idempotent-ish client retries.',
    },
  },
  {
    name: 'cancelSubscription',
    kind: 'workflow',
    entities: ['Subscription'],
    idempotency: {
      supported: false,
      notes: 'Treat cancel operations as retryable only with adapter-side dedupe + verification.',
    },
  },
  {
    name: 'generateDryRunInvoice',
    kind: 'workflow',
    entities: ['Invoice'],
    idempotency: { supported: true, mechanism: 'Dry run (no side effects)' },
    notes: 'See jaxrs InvoiceResource POST /dryRun.',
  },
  {
    name: 'createPayment',
    kind: 'workflow',
    entities: ['Payment', 'PaymentTransaction'],
    idempotency: {
      supported: true,
      mechanism: 'paymentExternalKey + transactionExternalKey (body)',
      notes: 'Adapter must supply stable external keys per attempt for safe retries.',
    },
  },
  {
    name: 'refundPayment',
    kind: 'workflow',
    entities: ['PaymentTransaction'],
    idempotency: {
      supported: true,
      mechanism: 'transactionExternalKey (body)',
      notes: 'Refunds should use a stable transactionExternalKey for retry safety.',
    },
  },
];

const EVENTS = [
  {
    name: 'invoice.changed',
    delivery: 'poll',
    entities: ['Invoice'],
    notes:
      'Kill Bill does not expose first-class webhooks in core; polling is the portable baseline.',
  },
  {
    name: 'payment.changed',
    delivery: 'poll',
    entities: ['Payment', 'PaymentTransaction'],
    notes: 'Polling recommended unless a deployment provides an event bridge.',
  },
];

const EXTENSION_POINTS = {
  customFields: {
    supported: true,
    notes:
      'Kill Bill supports custom fields on various object types via the util custom field subsystem.',
  },
  tags: {
    supported: true,
    notes: 'Kill Bill supports tags (including control tags) on various object types.',
  },
  attachments: { supported: false },
  comments: { supported: false },
  activities: { supported: false },
};

function main() {
  const sourceManifest = readJson(sourceManifestPath);
  const commit =
    typeof sourceManifest?.upstream?.commit === 'string' &&
    sourceManifest.upstream.commit.trim().length > 0
      ? sourceManifest.upstream.commit.trim()
      : undefined;

  const entities = ENTITY_SPECS.map(extractEntity);

  const cif = {
    schemaVersion: '1.0.0',
    source: {
      providerId,
      providerName:
        typeof sourceManifest?.providerName === 'string' &&
        sourceManifest.providerName.trim().length > 0
          ? sourceManifest.providerName.trim()
          : providerId,
      upstream: {
        repoUrl: sourceManifest?.upstream?.repoUrl,
        commit,
        version: sourceManifest?.upstream?.version,
      },
    },
    extractedAt: nowIsoUtc(),
    entities,
    relationships: RELATIONSHIPS,
    lifecycles: LIFECYCLES,
    actions: ACTIONS,
    events: EVENTS,
    extensionPoints: EXTENSION_POINTS,
  };

  writeJson(outPath, cif);
}

main();
