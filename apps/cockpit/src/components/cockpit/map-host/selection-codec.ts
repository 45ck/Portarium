import type { MapHostSelection } from './types';

const SELECTION_SEPARATOR = ':';

export function encodeMapHostSelection(selection: MapHostSelection | null | undefined): string {
  if (!selection) return '';

  return [selection.kind, selection.id]
    .map((part) => encodeURIComponent(part))
    .join(SELECTION_SEPARATOR);
}

export function decodeMapHostSelection<TKind extends string = string>(
  value: string | null | undefined,
  allowedKinds?: readonly TKind[],
): MapHostSelection<TKind> | null {
  if (!value) return null;

  const separatorIndex = value.indexOf(SELECTION_SEPARATOR);
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) return null;

  let kind: string;
  let id: string;

  try {
    kind = decodeURIComponent(value.slice(0, separatorIndex));
    id = decodeURIComponent(value.slice(separatorIndex + 1));
  } catch {
    return null;
  }

  if (!kind || !id) return null;
  if (allowedKinds && !allowedKinds.includes(kind as TKind)) return null;

  return { kind: kind as TKind, id };
}
