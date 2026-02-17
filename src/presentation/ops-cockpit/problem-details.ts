export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: Record<string, string[]>;
}

export class ProblemDetailsError extends Error {
  public readonly problem: ProblemDetails;
  public readonly status: number;

  constructor(problem: ProblemDetails) {
    super(problem.title);
    this.name = 'ProblemDetailsError';
    this.problem = problem;
    this.status = problem.status;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isProblemDetails(value: unknown): value is ProblemDetails {
  if (!isRecord(value)) return false;

  const maybeType = value['type'];
  const maybeTitle = value['title'];
  const maybeStatus = value['status'];

  if (typeof maybeType !== 'string' || maybeType.length === 0) return false;
  if (typeof maybeTitle !== 'string' || maybeTitle.length === 0) return false;
  if (!Number.isInteger(maybeStatus)) return false;

  return true;
}

export function parseProblemDetails(value: unknown): ProblemDetails {
  if (!isProblemDetails(value)) {
    throw new Error('Invalid Problem Details payload.');
  }
  return value;
}
