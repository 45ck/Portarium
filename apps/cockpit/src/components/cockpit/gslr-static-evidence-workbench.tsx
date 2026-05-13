import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  FileJson2,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { GSLR_MANUAL_BUNDLE_ADVERSARIAL_FIXTURES } from './gslr-manual-bundle-adversarial-fixtures';
import { GSLR_MANUAL_BUNDLE_PREVIEW_FIXTURES } from './gslr-manual-bundle-preview-fixtures';
import { sha256Hex } from './gslr-manual-bundle-preview';
import {
  canonicalizeGslrEvidenceBundlePayloadV1,
  runGslrStaticImporterDryRunV1,
  type GslrEvidenceBundleV1,
  type GslrStaticImportedRecordArtifactByteStatusV1,
  type GslrStaticImporterDryRunResultV1,
} from '@portarium/domain-evidence';
import { HashSha256 } from '@portarium/domain-primitives';

type WorkbenchResult =
  | Readonly<{ kind: 'idle' }>
  | Readonly<{ kind: 'invalid-json'; message: string }>
  | Readonly<{ kind: 'dry-run'; result: GslrStaticImporterDryRunResultV1 }>;

type WorkbenchFixture = Readonly<{
  id: string;
  label: string;
  sourceRef: string;
  bundleJson: string;
  verifiedArtifactByteStatus?: GslrStaticImportedRecordArtifactByteStatusV1;
}>;

export type GslrStaticEvidenceWorkbenchOperatorReportPacketV1 = Readonly<{
  schemaVersion: 'portarium.gslr-static-evidence-workbench-operator-report.v1';
  contentType: 'application/vnd.portarium.gslr-static-evidence-workbench-report+json;version=1';
  filename: string;
  route: '/engineering/evidence-cards/workbench';
  generatedAtIso: string;
  dryRunStatus: GslrStaticImporterDryRunResultV1['status'];
  sourceRef: string;
  recordId: string;
  recordStatus: GslrStaticImporterDryRunResultV1['record']['status'];
  reviewState: GslrStaticImporterDryRunResultV1['record']['reviewState'];
  signerTrust: GslrStaticImporterDryRunResultV1['record']['signer']['trust'];
  artifactByteStatuses: readonly GslrStaticImportedRecordArtifactByteStatusV1[];
  verification:
    | Readonly<{ status: 'verified'; rejection: null }>
    | Readonly<{
        status: 'rejected';
        rejection: Readonly<{ code: string; category: string }>;
      }>;
  plan: Readonly<{
    status: GslrStaticImporterDryRunResultV1['plan']['status'];
    idempotencyKey: string;
    blockers: readonly string[];
  }>;
  repository: Readonly<{
    entries: number;
    auditEvent: string | null;
    appendRejection: string | null;
  }>;
  boundaryWarnings: readonly string[];
  reportText: string;
}>;

const DEFAULT_NOW_ISO = '2026-05-13T04:30:00.000Z';
const DEFAULT_DRY_RUN_AT_ISO = '2026-05-13T05:00:00.000Z';
const DEFAULT_ACTOR = 'operator:gslr-workbench';

const workbenchFixtures: readonly WorkbenchFixture[] = [
  {
    id: 'gslr8-production-trusted',
    label: 'GSLR-8 accepted dry-run',
    sourceRef: 'fixtures/gslr20/gslr8-route-record-compiler-production-trusted.bundle.json',
    bundleJson: productionTrustedBundleJson(GSLR_MANUAL_BUNDLE_PREVIEW_FIXTURES[0].bundleJson),
  },
  {
    id: 'gslr8-test-fixture',
    label: 'GSLR-8 test-signature blocked',
    sourceRef: 'fixtures/gslr20/gslr8-route-record-compiler-test-fixture.bundle.json',
    bundleJson: GSLR_MANUAL_BUNDLE_PREVIEW_FIXTURES[0].bundleJson,
  },
  {
    id: 'gslr8-artifact-not-fetched',
    label: 'GSLR-8 artifact bytes blocked',
    sourceRef: 'fixtures/gslr20/gslr8-route-record-compiler-artifact-not-fetched.bundle.json',
    bundleJson: productionTrustedBundleJson(GSLR_MANUAL_BUNDLE_PREVIEW_FIXTURES[0].bundleJson),
    verifiedArtifactByteStatus: 'not_fetched',
  },
  {
    id: 'invalid-signature',
    label: 'Invalid signature quarantine',
    sourceRef: adversarialFixture('invalid-signature').sourceRef,
    bundleJson: adversarialFixture('invalid-signature').bundleJson,
  },
  {
    id: 'runtime-authority',
    label: 'Runtime authority quarantine',
    sourceRef: adversarialFixture('runtime-authority-claim').sourceRef,
    bundleJson: adversarialFixture('runtime-authority-claim').bundleJson,
  },
];

const workbenchHasher = {
  sha256Hex(input: string) {
    return HashSha256(sha256Hex(input));
  },
};

const workbenchSignatureVerifier = {
  verify(canonical: string, signatureBase64: string) {
    return signatureBase64 === base64Ascii(`sig:${canonical.length}`);
  },
};

export function runGslrStaticEvidenceWorkbenchDryRun(input: {
  bundleText: string;
  sourceRef: string;
  nowIso: string;
  dryRunAtIso: string;
  actor: string;
  verifiedArtifactByteStatus?: GslrStaticImportedRecordArtifactByteStatusV1;
}): WorkbenchResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.bundleText);
  } catch (error) {
    return {
      kind: 'invalid-json',
      message: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    kind: 'dry-run',
    result: runGslrStaticImporterDryRunV1({
      bundle: parsed,
      sourceRef: input.sourceRef,
      nowIso: input.nowIso,
      dryRunAtIso: input.dryRunAtIso,
      actor: input.actor,
      hasher: workbenchHasher,
      signatureVerifier: workbenchSignatureVerifier,
      ...(input.verifiedArtifactByteStatus !== undefined
        ? { verifiedArtifactByteStatus: input.verifiedArtifactByteStatus }
        : {}),
    }),
  };
}

export function buildGslrStaticEvidenceWorkbenchOperatorReportPacketV1(
  result: GslrStaticImporterDryRunResultV1,
): GslrStaticEvidenceWorkbenchOperatorReportPacketV1 {
  const record = result.record;
  const artifactByteStatuses = record.artifacts.map((artifact) => artifact.byteVerificationStatus);
  const verification =
    record.verification.status === 'verified'
      ? ({ status: 'verified', rejection: null } as const)
      : ({
          status: 'rejected',
          rejection: {
            code: record.verification.rejection.code,
            category: record.verification.rejection.category,
          },
        } as const);

  return deepFreeze({
    schemaVersion: 'portarium.gslr-static-evidence-workbench-operator-report.v1',
    contentType: 'application/vnd.portarium.gslr-static-evidence-workbench-report+json;version=1',
    filename: `${safeFilename(record.subject.task ?? record.recordId)}-${result.status}-operator-report.json`,
    route: '/engineering/evidence-cards/workbench',
    generatedAtIso: record.importedAtIso,
    dryRunStatus: result.status,
    sourceRef: result.sourceRef,
    recordId: record.recordId,
    recordStatus: record.status,
    reviewState: record.reviewState,
    signerTrust: record.signer.trust,
    artifactByteStatuses,
    verification,
    plan: {
      status: result.plan.status,
      idempotencyKey: result.plan.idempotencyKey,
      blockers: result.plan.blockers,
    },
    repository: {
      entries: result.repositoryEntries.length,
      auditEvent: result.appendResult?.auditEvent.eventType ?? null,
      appendRejection: result.appendRejection
        ? `${result.appendRejection.code}: ${result.appendRejection.message}`
        : null,
    },
    boundaryWarnings: result.boundaryWarnings,
    reportText: operatorReport(result),
  });
}

export function serializeGslrStaticEvidenceWorkbenchOperatorReportPacketV1(
  packet: GslrStaticEvidenceWorkbenchOperatorReportPacketV1,
) {
  return `${JSON.stringify(packet, null, 2)}\n`;
}

export function GslrStaticEvidenceWorkbench() {
  const [selectedFixtureId, setSelectedFixtureId] = useState(workbenchFixtures[0].id);
  const [sourceRef, setSourceRef] = useState(workbenchFixtures[0].sourceRef);
  const [bundleText, setBundleText] = useState(workbenchFixtures[0].bundleJson);
  const [nowIso, setNowIso] = useState(DEFAULT_NOW_ISO);
  const [dryRunAtIso, setDryRunAtIso] = useState(DEFAULT_DRY_RUN_AT_ISO);
  const [actor, setActor] = useState(DEFAULT_ACTOR);
  const [verifiedArtifactByteStatus, setVerifiedArtifactByteStatus] = useState<
    GslrStaticImportedRecordArtifactByteStatusV1 | undefined
  >(workbenchFixtures[0].verifiedArtifactByteStatus);
  const [result, setResult] = useState<WorkbenchResult>({ kind: 'idle' });

  const selectedFixture = useMemo(
    () => workbenchFixtures.find((fixture) => fixture.id === selectedFixtureId) ?? null,
    [selectedFixtureId],
  );

  function loadFixture(fixture: WorkbenchFixture) {
    setSelectedFixtureId(fixture.id);
    setSourceRef(fixture.sourceRef);
    setBundleText(fixture.bundleJson);
    setVerifiedArtifactByteStatus(fixture.verifiedArtifactByteStatus);
    setResult({ kind: 'idle' });
  }

  function runDryRun() {
    setResult(
      runGslrStaticEvidenceWorkbenchDryRun({
        bundleText,
        sourceRef,
        nowIso,
        dryRunAtIso,
        actor,
        verifiedArtifactByteStatus,
      }),
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(430px,1.05fr)]">
      <section className="space-y-4">
        <Alert variant="warning">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Static review only</AlertTitle>
          <AlertDescription>
            This workbench runs the GSLR-20 dry-run in memory. It does not persist imports, poll
            prompt-language, create runtime cards, open streams, execute actions, or access MC
            connectors.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileJson2 className="h-4 w-4" aria-hidden="true" />
              Static bundle input
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {workbenchFixtures.map((fixture) => (
                <Button
                  key={fixture.id}
                  type="button"
                  variant={selectedFixtureId === fixture.id ? 'secondary' : 'outline'}
                  onClick={() => loadFixture(fixture)}
                >
                  {fixture.label}
                </Button>
              ))}
            </div>

            {selectedFixture ? (
              <p className="break-all rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Loaded fixture: {selectedFixture.sourceRef}
              </p>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="gslr-workbench-source-ref">Source ref</Label>
              <Input
                id="gslr-workbench-source-ref"
                value={sourceRef}
                onChange={(event) => {
                  setSourceRef(event.currentTarget.value);
                  setSelectedFixtureId('custom');
                  setResult({ kind: 'idle' });
                }}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="gslr-workbench-now">Verification time</Label>
                <Input
                  id="gslr-workbench-now"
                  value={nowIso}
                  onChange={(event) => setNowIso(event.currentTarget.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="gslr-workbench-dry-run-at">Dry-run time</Label>
                <Input
                  id="gslr-workbench-dry-run-at"
                  value={dryRunAtIso}
                  onChange={(event) => setDryRunAtIso(event.currentTarget.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="gslr-workbench-actor">Actor</Label>
              <Input
                id="gslr-workbench-actor"
                value={actor}
                onChange={(event) => setActor(event.currentTarget.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="gslr-workbench-bundle">GSLR bundle JSON</Label>
              <Textarea
                id="gslr-workbench-bundle"
                value={bundleText}
                onChange={(event) => {
                  setBundleText(event.currentTarget.value);
                  setSelectedFixtureId('custom');
                  setResult({ kind: 'idle' });
                }}
                className="min-h-[360px] font-mono text-xs"
                spellCheck={false}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={runDryRun}>
                <ShieldCheck className="h-4 w-4" />
                Run dry-run
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  loadFixture(workbenchFixtures[0]);
                  setNowIso(DEFAULT_NOW_ISO);
                  setDryRunAtIso(DEFAULT_DRY_RUN_AT_ISO);
                  setActor(DEFAULT_ACTOR);
                }}
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <WorkbenchResultPanel result={result} />
      </section>
    </div>
  );
}

function WorkbenchResultPanel({ result }: { result: WorkbenchResult }) {
  if (result.kind === 'idle') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            Dry-run result
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Run the dry-run to inspect verifier state, imported-record preview, append plan, blockers,
          repository state, audit event, and report text.
        </CardContent>
      </Card>
    );
  }

  if (result.kind === 'invalid-json') {
    return (
      <Alert variant="destructive">
        <XCircle aria-hidden="true" />
        <AlertTitle>Bundle JSON rejected</AlertTitle>
        <AlertDescription>{result.message}</AlertDescription>
      </Alert>
    );
  }

  const dryRun = result.result;
  const record = dryRun.record;
  const appendEvent = dryRun.appendResult?.auditEvent ?? null;
  const reportPacket = buildGslrStaticEvidenceWorkbenchOperatorReportPacketV1(dryRun);

  return (
    <>
      <Alert variant={dryRun.status === 'planned-blocked' ? 'warning' : 'success'}>
        {dryRun.status === 'planned-blocked' ? (
          <AlertCircle aria-hidden="true" />
        ) : (
          <CheckCircle2 aria-hidden="true" />
        )}
        <AlertTitle>{statusTitle(dryRun.status)}</AlertTitle>
        <AlertDescription>
          {record.subject.task ?? 'unknown task'} is {record.status} with review state{' '}
          {record.reviewState}.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Imported-record preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <KeyValue label="Record ID" value={record.recordId} />
          <KeyValue label="Source ref" value={record.sourceRef} />
          <KeyValue label="Bundle" value={record.bundle.bundleId ?? 'unknown'} />
          <KeyValue label="Signer trust" value={record.signer.trust} />
          <KeyValue
            label="Verification"
            value={
              record.verification.status === 'verified'
                ? 'verified'
                : `${record.verification.rejection.code} / ${record.verification.rejection.category}`
            }
          />
          <div className="flex flex-wrap gap-2">
            <Badge variant={record.status === 'accepted_static' ? 'success' : 'warning'}>
              {record.status}
            </Badge>
            <Badge variant="outline">{record.reviewState}</Badge>
            <Badge variant="outline">runtime {record.authority.runtimeAuthority}</Badge>
            <Badge variant="outline">actions {record.authority.actionControls}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Append plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <KeyValue label="Plan status" value={dryRun.plan.status} />
          <KeyValue label="Idempotency key" value={dryRun.plan.idempotencyKey} />
          {dryRun.plan.blockers.length > 0 ? (
            <ul className="grid gap-2">
              {dryRun.plan.blockers.map((blocker) => (
                <li
                  key={blocker}
                  className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2"
                >
                  {blocker}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-md border bg-muted/30 px-3 py-2 text-muted-foreground">
              No append blockers in this dry-run.
            </p>
          )}
          {dryRun.plan.failureReport ? (
            <KeyValue
              label="Failure report"
              value={`${dryRun.plan.failureReport.rejectionCode} / ${dryRun.plan.failureReport.rejectionCategory}`}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Repository dry-run</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <KeyValue label="Entries" value={String(dryRun.repositoryEntries.length)} />
          {appendEvent ? (
            <>
              <KeyValue label="Audit event" value={appendEvent.eventType} />
              <KeyValue label="Audit reason" value={appendEvent.reason ?? 'none'} />
            </>
          ) : null}
          {dryRun.appendRejection ? (
            <KeyValue
              label="Append rejection"
              value={`${dryRun.appendRejection.code}: ${dryRun.appendRejection.message}`}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Operator report export</CardTitle>
            <OperatorReportActions packet={reportPacket} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <KeyValue label="Export schema" value={reportPacket.schemaVersion} />
            <KeyValue label="Filename" value={reportPacket.filename} />
          </div>
          <pre className="max-h-[360px] overflow-auto rounded-md border bg-muted/30 p-3 text-xs">
            {reportPacket.reportText}
          </pre>
        </CardContent>
      </Card>
    </>
  );
}

function OperatorReportActions({
  packet,
}: {
  packet: GslrStaticEvidenceWorkbenchOperatorReportPacketV1;
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const serialized = serializeGslrStaticEvidenceWorkbenchOperatorReportPacketV1(packet);

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(serialized);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  function downloadReport() {
    const blob = new Blob([serialized], { type: packet.contentType });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = packet.filename;
    anchor.rel = 'noopener';
    anchor.click();
    URL.revokeObjectURL(href);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={copyReport}>
        <Copy className="h-4 w-4" aria-hidden="true" />
        {copyState === 'copied'
          ? 'Copied report'
          : copyState === 'failed'
            ? 'Copy failed'
            : 'Copy JSON'}
      </Button>
      <Button type="button" variant="outline" onClick={downloadReport}>
        <Download className="h-4 w-4" aria-hidden="true" />
        Download JSON
      </Button>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
      <dd className="break-words font-mono text-xs">{value}</dd>
    </div>
  );
}

function statusTitle(status: GslrStaticImporterDryRunResultV1['status']) {
  if (status === 'stored') return 'Dry-run stored static record';
  if (status === 'replayed') return 'Dry-run replayed idempotently';
  if (status === 'planned-blocked') return 'Dry-run blocked before append';
  return 'Dry-run append rejected';
}

function operatorReport(result: GslrStaticImporterDryRunResultV1) {
  const record = result.record;
  return [
    `GSLR static evidence workbench report`,
    `status: ${result.status}`,
    `sourceRef: ${result.sourceRef}`,
    `recordId: ${record.recordId}`,
    `task: ${record.subject.task ?? 'unknown'}`,
    `recordStatus: ${record.status}`,
    `reviewState: ${record.reviewState}`,
    `signerTrust: ${record.signer.trust}`,
    `artifactByteStatus: ${record.artifacts.map((artifact) => artifact.byteVerificationStatus).join(', ') || 'none'}`,
    `verification: ${record.verification.status}`,
    `rejection: ${
      record.verification.status === 'rejected'
        ? `${record.verification.rejection.code}/${record.verification.rejection.category}`
        : 'none'
    }`,
    `planStatus: ${result.plan.status}`,
    `blockers: ${result.plan.blockers.length === 0 ? 'none' : result.plan.blockers.join(' | ')}`,
    `repositoryEntries: ${result.repositoryEntries.length}`,
    `auditEvent: ${result.appendResult?.auditEvent.eventType ?? 'none'}`,
    `runtimeAuthority: ${record.authority.runtimeAuthority}`,
    `actionControls: ${record.authority.actionControls}`,
    `liveEndpoints: ${record.authority.liveEndpoints}`,
    `boundary: static review only; no persistence, polling, queues, SSE, runtime cards, production actions, or MC connector access`,
  ].join('\n');
}

function productionTrustedBundleJson(bundleJson: string) {
  const bundle = JSON.parse(bundleJson) as GslrEvidenceBundleV1;
  const draft = {
    ...bundle,
    verification: {
      ...bundle.verification,
      signer: {
        keyId: 'gslr-production-key-2026-05-13',
        algorithm: 'ed25519',
      },
    },
  } satisfies GslrEvidenceBundleV1;
  const canonical = canonicalizeGslrEvidenceBundlePayloadV1(draft);
  return JSON.stringify(
    {
      ...draft,
      verification: {
        ...draft.verification,
        payloadHashSha256: HashSha256(sha256Hex(canonical)),
        signatureBase64: base64Ascii(`sig:${canonical.length}`),
      },
    },
    null,
    2,
  );
}

function adversarialFixture(caseId: string) {
  const fixture = GSLR_MANUAL_BUNDLE_ADVERSARIAL_FIXTURES.find((item) => item.caseId === caseId);
  if (fixture === undefined) {
    throw new Error(`Missing GSLR adversarial fixture ${caseId}`);
  }
  return fixture;
}

function base64Ascii(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let index = 0; index < value.length; index += 3) {
    const first = value.charCodeAt(index);
    const second = index + 1 < value.length ? value.charCodeAt(index + 1) : 0;
    const third = index + 2 < value.length ? value.charCodeAt(index + 2) : 0;
    const packed = (first << 16) | (second << 8) | third;
    out += alphabet[(packed >> 18) & 63];
    out += alphabet[(packed >> 12) & 63];
    out += index + 1 < value.length ? alphabet[(packed >> 6) & 63] : '=';
    out += index + 2 < value.length ? alphabet[packed & 63] : '=';
  }
  return out;
}

function safeFilename(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized.length === 0 ? 'gslr-static-evidence' : normalized;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  Object.freeze(value);
  for (const key of Object.keys(value as object)) {
    const child = (value as Record<string, unknown>)[key];
    if (child !== null && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return value;
}
