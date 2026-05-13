import {
  AlertCircle,
  CheckCircle2,
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
import {
  GslrStaticEvidenceCardView,
  toGslrStaticEvidenceCardExport,
} from './gslr-static-evidence-card-view';
import { GSLR_MANUAL_BUNDLE_ADVERSARIAL_FIXTURES } from './gslr-manual-bundle-adversarial-fixtures';
import { GSLR_MANUAL_BUNDLE_PREVIEW_FIXTURES } from './gslr-manual-bundle-preview-fixtures';
import {
  buildEngineeringEvidenceCardCockpitExportV1,
  GslrEvidenceBundleVerificationError,
  verifyGslrEvidenceBundleV1,
  type GslrEvidenceBundleV1,
} from '@portarium/domain-evidence';
import { HashSha256 } from '@portarium/domain-primitives';

export type GslrManualPreviewCheckStatus = 'verified' | 'rejected' | 'not-run';

export interface GslrManualPreviewCheck {
  label: string;
  status: GslrManualPreviewCheckStatus;
  detail: string;
}

export type GslrManualPreviewResult =
  | Readonly<{
      kind: 'idle';
      checks: readonly GslrManualPreviewCheck[];
    }>
  | Readonly<{
      kind: 'verified';
      checks: readonly GslrManualPreviewCheck[];
      card: ReturnType<typeof toGslrStaticEvidenceCardExport>;
      bundleId: string;
    }>
  | Readonly<{
      kind: 'rejected';
      checks: readonly GslrManualPreviewCheck[];
      errorTitle: string;
      errorMessage: string;
    }>;

const DEFAULT_NOW_ISO = '2026-05-13T02:00:00.000Z';

const idleChecks: readonly GslrManualPreviewCheck[] = [
  { label: 'JSON bundle', status: 'not-run', detail: 'Awaiting manual verification.' },
  { label: 'Payload hash', status: 'not-run', detail: 'Awaiting manual verification.' },
  { label: 'Signature', status: 'not-run', detail: 'Awaiting manual verification.' },
  { label: 'Provenance', status: 'not-run', detail: 'Awaiting manual verification.' },
  { label: 'Validity window', status: 'not-run', detail: 'Awaiting manual verification.' },
  { label: 'Artifact hash coverage', status: 'not-run', detail: 'Awaiting manual verification.' },
  { label: 'Static constraints', status: 'not-run', detail: 'Awaiting manual verification.' },
] as const;

const previewHasher = {
  sha256Hex(input: string) {
    return HashSha256(sha256Hex(input));
  },
};

const previewSignatureVerifier = {
  verify(canonical: string, signatureBase64: string) {
    return signatureBase64 === base64Ascii(`sig:${canonical.length}`);
  },
};

export function verifyGslrManualBundlePreview(
  bundleText: string,
  nowIso: string,
): GslrManualPreviewResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bundleText);
  } catch (error) {
    return {
      kind: 'rejected',
      errorTitle: 'Bundle JSON rejected',
      errorMessage: errorMessage(error),
      checks: [
        { label: 'JSON bundle', status: 'rejected', detail: errorMessage(error) },
        ...idleChecks.slice(1),
      ],
    };
  }

  try {
    const verified = verifyGslrEvidenceBundleV1(parsed, {
      hasher: previewHasher,
      signatureVerifier: previewSignatureVerifier,
      nowIso,
    });
    const exportModel = buildEngineeringEvidenceCardCockpitExportV1(verified.card);
    return {
      kind: 'verified',
      bundleId: verified.bundle.bundleId,
      card: toGslrStaticEvidenceCardExport(exportModel),
      checks: verifiedChecks(verified.bundle, nowIso),
    };
  } catch (error) {
    return {
      kind: 'rejected',
      errorTitle:
        error instanceof GslrEvidenceBundleVerificationError
          ? 'Bundle verification rejected'
          : 'Bundle preview failed',
      errorMessage: errorMessage(error),
      checks: rejectedChecks(errorMessage(error)),
    };
  }
}

function verifiedChecks(
  bundle: GslrEvidenceBundleV1,
  nowIso: string,
): readonly GslrManualPreviewCheck[] {
  return [
    {
      label: 'JSON bundle',
      status: 'verified',
      detail: `${bundle.schemaVersion} parsed successfully.`,
    },
    {
      label: 'Payload hash',
      status: 'verified',
      detail: bundle.verification.payloadHashSha256,
    },
    {
      label: 'Signature',
      status: 'verified',
      detail: `${bundle.verification.signer.algorithm} via ${bundle.verification.signer.keyId}`,
    },
    {
      label: 'Provenance',
      status: 'verified',
      detail: `${bundle.source.repo}@${bundle.source.commit.slice(0, 12)} run ${bundle.source.runId}`,
    },
    {
      label: 'Validity window',
      status: 'verified',
      detail: `${nowIso} is inside ${bundle.verification.notBeforeIso} to ${bundle.verification.expiresAtIso}.`,
    },
    {
      label: 'Artifact hash coverage',
      status: 'verified',
      detail: `${bundle.artifactHashes.length} repository-relative artifact hashes declared and cross-referenced.`,
    },
    {
      label: 'Static constraints',
      status: 'verified',
      detail: `${bundle.constraints.importMode}; runtime ${bundle.constraints.runtimeAuthority}; actions ${bundle.constraints.actionControls}.`,
    },
  ];
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function rejectedChecks(message: string): readonly GslrManualPreviewCheck[] {
  const rejectedLabel = rejectedCheckLabel(message);
  return [
    { label: 'JSON bundle', status: 'verified', detail: 'Bundle text parsed as JSON.' },
    ...idleChecks
      .slice(1)
      .map((check) =>
        check.label === rejectedLabel
          ? { ...check, status: 'rejected' as const, detail: message }
          : check,
      ),
  ];
}

function rejectedCheckLabel(message: string): GslrManualPreviewCheck['label'] {
  if (/payloadHashSha256/i.test(message)) return 'Payload hash';
  if (/signature/i.test(message)) return 'Signature';
  if (/source\.|subject\.|runId|runGroupId|policyVersion|task must match/i.test(message)) {
    return 'Provenance';
  }
  if (/verification window|createdAtIso|nowIso|notBeforeIso|expiresAtIso/i.test(message)) {
    return 'Validity window';
  }
  if (/artifact|missing artifact hash|repository-relative|traverse parents/i.test(message)) {
    return 'Artifact hash coverage';
  }
  return 'Static constraints';
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

export function sha256Hex(input: string) {
  const bytes = new TextEncoder().encode(input);
  const words: number[] = [];
  for (let index = 0; index < bytes.length; index += 1) {
    words[index >> 2] = (words[index >> 2] ?? 0) | (bytes[index]! << (24 - (index % 4) * 8));
  }
  words[bytes.length >> 2] =
    (words[bytes.length >> 2] ?? 0) | (0x80 << (24 - (bytes.length % 4) * 8));
  words[(((bytes.length + 8) >> 6) << 4) + 15] = bytes.length * 8;

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  for (let chunk = 0; chunk < words.length; chunk += 16) {
    const schedule = new Array<number>(64);
    for (let index = 0; index < 16; index += 1) {
      schedule[index] = words[chunk + index] ?? 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 =
        rotateRight(schedule[index - 15]!, 7) ^
        rotateRight(schedule[index - 15]!, 18) ^
        (schedule[index - 15]! >>> 3);
      const s1 =
        rotateRight(schedule[index - 2]!, 17) ^
        rotateRight(schedule[index - 2]!, 19) ^
        (schedule[index - 2]! >>> 10);
      schedule[index] = add32(schedule[index - 16]!, s0, schedule[index - 7]!, s1);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let index = 0; index < 64; index += 1) {
      const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = add32(h, s1, ch, SHA256_K[index]!, schedule[index]!);
      const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = add32(s0, maj);
      h = g;
      g = f;
      f = e;
      e = add32(d, temp1);
      d = c;
      c = b;
      b = a;
      a = add32(temp1, temp2);
    }

    h0 = add32(h0, a);
    h1 = add32(h1, b);
    h2 = add32(h2, c);
    h3 = add32(h3, d);
    h4 = add32(h4, e);
    h5 = add32(h5, f);
    h6 = add32(h6, g);
    h7 = add32(h7, h);
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((word) => (word >>> 0).toString(16).padStart(8, '0'))
    .join('');
}

function rotateRight(value: number, bits: number) {
  return (value >>> bits) | (value << (32 - bits));
}

function add32(...values: number[]) {
  return values.reduce((sum, value) => (sum + value) | 0, 0);
}

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

function statusVariant(status: GslrManualPreviewCheckStatus) {
  if (status === 'verified') return 'success' as const;
  if (status === 'rejected') return 'destructive' as const;
  return 'outline' as const;
}

function StatusIcon({ status }: { status: GslrManualPreviewCheckStatus }) {
  if (status === 'verified') return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === 'rejected') return <XCircle className="h-4 w-4 text-destructive" />;
  return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
}

function VerificationChecks({ checks }: { checks: readonly GslrManualPreviewCheck[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Verification checks
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2">
          {checks.map((check) => (
            <li key={check.label} className="rounded-md border bg-background px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <StatusIcon status={check.status} />
                <span className="font-medium">{check.label}</span>
                <Badge variant={statusVariant(check.status)}>{check.status}</Badge>
              </div>
              <p className="mt-1 break-words text-xs text-muted-foreground">{check.detail}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function GslrManualBundlePreview() {
  const [bundleText, setBundleText] = useState<string>(
    GSLR_MANUAL_BUNDLE_PREVIEW_FIXTURES[0].bundleJson,
  );
  const [nowIso, setNowIso] = useState(DEFAULT_NOW_ISO);
  const [result, setResult] = useState<GslrManualPreviewResult>({
    kind: 'idle',
    checks: idleChecks,
  });
  const selectedFixture = useMemo(
    () =>
      [...GSLR_MANUAL_BUNDLE_PREVIEW_FIXTURES, ...GSLR_MANUAL_BUNDLE_ADVERSARIAL_FIXTURES].find(
        (fixture) => fixture.bundleJson === bundleText,
      ),
    [bundleText],
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
      <section className="space-y-4">
        <Alert variant="warning">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Manual static preview only</AlertTitle>
          <AlertDescription>
            Verification runs in memory against pasted or loaded fixture JSON. It does not persist a
            bundle, create runtime evidence cards, open queues, subscribe to streams, or expose
            action controls.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileJson2 className="h-4 w-4" aria-hidden="true" />
              Bundle input
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {GSLR_MANUAL_BUNDLE_PREVIEW_FIXTURES.map((fixture) => (
                <Button
                  key={fixture.task}
                  type="button"
                  variant={
                    selectedFixture?.sourceRef === fixture.sourceRef ? 'secondary' : 'outline'
                  }
                  onClick={() => {
                    setBundleText(fixture.bundleJson);
                    setResult({ kind: 'idle', checks: idleChecks });
                  }}
                >
                  {fixture.label}
                </Button>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Rejection corpus
              </p>
              <div className="flex flex-wrap gap-2">
                {GSLR_MANUAL_BUNDLE_ADVERSARIAL_FIXTURES.map((fixture) => (
                  <Button
                    key={fixture.caseId}
                    type="button"
                    variant={
                      selectedFixture?.sourceRef === fixture.sourceRef ? 'secondary' : 'outline'
                    }
                    onClick={() => {
                      setBundleText(fixture.bundleJson);
                      setResult({ kind: 'idle', checks: idleChecks });
                    }}
                  >
                    {fixture.label}
                  </Button>
                ))}
              </div>
            </div>

            {selectedFixture ? (
              <p className="break-all rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Source fixture: {selectedFixture.sourceRef}
              </p>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="gslr-preview-now">Verification time</Label>
              <Input
                id="gslr-preview-now"
                value={nowIso}
                onChange={(event) => setNowIso(event.currentTarget.value)}
                aria-label="Verification time"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="gslr-preview-bundle">GSLR bundle JSON</Label>
              <Textarea
                id="gslr-preview-bundle"
                value={bundleText}
                onChange={(event) => {
                  setBundleText(event.currentTarget.value);
                  setResult({ kind: 'idle', checks: idleChecks });
                }}
                className="min-h-[420px] font-mono text-xs"
                spellCheck={false}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => setResult(verifyGslrManualBundlePreview(bundleText, nowIso))}
              >
                <ShieldCheck className="h-4 w-4" />
                Verify bundle
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setBundleText(GSLR_MANUAL_BUNDLE_PREVIEW_FIXTURES[0].bundleJson);
                  setNowIso(DEFAULT_NOW_ISO);
                  setResult({ kind: 'idle', checks: idleChecks });
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
        <VerificationChecks checks={result.checks} />
        {result.kind === 'rejected' ? (
          <Alert variant="destructive">
            <XCircle aria-hidden="true" />
            <AlertTitle>{result.errorTitle}</AlertTitle>
            <AlertDescription>{result.errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        {result.kind === 'verified' ? (
          <>
            <Alert variant="success">
              <CheckCircle2 aria-hidden="true" />
              <AlertTitle>Bundle verified</AlertTitle>
              <AlertDescription>
                {result.bundleId} verified and projected to a static Cockpit evidence card.
              </AlertDescription>
            </Alert>
            <GslrStaticEvidenceCardView
              cards={[result.card]}
              introTitle="Verified static bundle projection"
              introDescription="This card is rendered only after the GSLR evidence bundle verifier passes. It remains static R&D evidence with no persistence, queues, runtime actions, or connector access."
            />
          </>
        ) : null}
      </section>
    </div>
  );
}
