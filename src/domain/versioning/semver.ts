export type SemVer = Readonly<{
  major: number;
  minor: number;
  patch: number;
  preRelease: readonly (number | string)[];
  build: string | null;
}>;

export class SemVerParseError extends Error {
  public override readonly name = 'SemVerParseError';

  public constructor(message: string) {
    super(message);
  }
}

const SEMVER_RE =
  /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-(?<pre>[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+(?<build>[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

export function parseSemVer(input: string): SemVer {
  const trimmed = input.trim();
  const match = SEMVER_RE.exec(trimmed);
  if (!match?.groups) {
    throw new SemVerParseError(`Invalid SemVer: "${input}"`);
  }

  const major = parseInt(match.groups['major'] ?? '', 10);
  const minor = parseInt(match.groups['minor'] ?? '', 10);
  const patch = parseInt(match.groups['patch'] ?? '', 10);

  if (
    !Number.isSafeInteger(major) ||
    !Number.isSafeInteger(minor) ||
    !Number.isSafeInteger(patch)
  ) {
    throw new SemVerParseError(`Invalid SemVer: "${input}"`);
  }

  const preRelease = parsePreRelease(match.groups['pre']);
  const build = match.groups['build'] ?? null;

  return { major, minor, patch, preRelease, build };
}

function parsePreRelease(pre: string | undefined): readonly (number | string)[] {
  if (!pre) return [];
  return pre.split('.').map((id) => {
    // Per SemVer, numeric identifiers must not include leading zeros.
    if (/^(0|[1-9]\d*)$/.test(id)) return parseInt(id, 10);
    return id;
  });
}

export function formatSemVer(v: SemVer): string {
  const core = `${v.major}.${v.minor}.${v.patch}`;
  const pre = v.preRelease.length === 0 ? '' : `-${v.preRelease.map(String).join('.')}`;
  const build = v.build ? `+${v.build}` : '';
  return `${core}${pre}${build}`;
}

export function compareSemVer(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major > b.major ? 1 : -1;
  if (a.minor !== b.minor) return a.minor > b.minor ? 1 : -1;
  if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1;

  return comparePreRelease(a.preRelease, b.preRelease);
}

function comparePreRelease(
  a: readonly (number | string)[],
  b: readonly (number | string)[],
): number {
  // A release version has higher precedence than a pre-release.
  const aEmpty = a.length === 0;
  const bEmpty = b.length === 0;
  if (aEmpty || bEmpty) {
    if (aEmpty && bEmpty) return 0;
    return aEmpty ? 1 : -1;
  }

  const minLen = Math.min(a.length, b.length);
  for (let i = 0; i < minLen; i += 1) {
    const cmp = comparePreReleaseIdentifier(a[i]!, b[i]!);
    if (cmp !== 0) return cmp;
  }

  if (a.length === b.length) return 0;
  return a.length > b.length ? 1 : -1;
}

function comparePreReleaseIdentifier(a: number | string, b: number | string): number {
  if (a === b) return 0;

  const aIsNum = typeof a === 'number';
  const bIsNum = typeof b === 'number';
  if (aIsNum && bIsNum) return a > b ? 1 : -1;

  // Per SemVer, numeric identifiers have lower precedence than non-numeric.
  if (aIsNum) return -1;
  if (bIsNum) return 1;

  return a > b ? 1 : -1;
}
