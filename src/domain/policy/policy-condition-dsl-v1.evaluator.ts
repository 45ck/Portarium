import {
  PolicyConditionEvaluationError,
  PolicyConditionTimeoutError,
  type BinaryOperator,
  type ExpressionNode,
  type UnaryNode,
} from './policy-condition-dsl-v1.types.js';

export function evaluatePolicyConditionDslAstV1(input: {
  ast: ExpressionNode;
  context: Readonly<Record<string, unknown>>;
  maxOperations: number;
}): boolean {
  const budget = new OperationBudget(input.maxOperations);
  const value = evaluateExpressionNode(input.ast, input.context, budget);
  if (typeof value !== 'boolean') {
    throw new PolicyConditionEvaluationError('Condition must evaluate to a boolean value.');
  }
  return value;
}

class OperationBudget {
  #remaining: number;

  public constructor(maxOperations: number) {
    if (!Number.isInteger(maxOperations) || maxOperations <= 0) {
      throw new PolicyConditionEvaluationError('maxOperations must be a positive integer.');
    }
    this.#remaining = maxOperations;
  }

  public consume(): void {
    this.#remaining -= 1;
    if (this.#remaining < 0) {
      throw new PolicyConditionTimeoutError('Policy condition evaluation timed out.');
    }
  }
}

function evaluateExpressionNode(
  node: ExpressionNode,
  context: Readonly<Record<string, unknown>>,
  budget: OperationBudget,
): unknown {
  budget.consume();
  switch (node.kind) {
    case 'literal':
      return node.value;
    case 'identifier':
      return resolveIdentifierPath(node.path, context, budget);
    case 'unary':
      return evaluateUnary(node, context, budget);
    case 'binary':
      return evaluateBinary(node, context, budget);
  }
}

function evaluateUnary(
  node: UnaryNode,
  context: Readonly<Record<string, unknown>>,
  budget: OperationBudget,
): boolean {
  const value = evaluateExpressionNode(node.operand, context, budget);
  return !toBoolean(value, 'Unary not operand must be boolean.');
}

function evaluateBinary(
  node: Extract<ExpressionNode, { kind: 'binary' }>,
  context: Readonly<Record<string, unknown>>,
  budget: OperationBudget,
): boolean {
  if (node.operator === 'and') {
    const left = toBoolean(
      evaluateExpressionNode(node.left, context, budget),
      'Left operand of and must be boolean.',
    );
    if (!left) return false;
    return toBoolean(
      evaluateExpressionNode(node.right, context, budget),
      'Right operand of and must be boolean.',
    );
  }

  if (node.operator === 'or') {
    const left = toBoolean(
      evaluateExpressionNode(node.left, context, budget),
      'Left operand of or must be boolean.',
    );
    if (left) return true;
    return toBoolean(
      evaluateExpressionNode(node.right, context, budget),
      'Right operand of or must be boolean.',
    );
  }

  const left = evaluateExpressionNode(node.left, context, budget);
  const right = evaluateExpressionNode(node.right, context, budget);
  return evaluateComparison(node.operator, left, right);
}

function evaluateComparison(operator: BinaryOperator, left: unknown, right: unknown): boolean {
  switch (operator) {
    case 'eq':
      return left === right;
    case 'neq':
      return left !== right;
    case 'lt':
      return compareOrdered(left, right, (a, b) => a < b);
    case 'lte':
      return compareOrdered(left, right, (a, b) => a <= b);
    case 'gt':
      return compareOrdered(left, right, (a, b) => a > b);
    case 'gte':
      return compareOrdered(left, right, (a, b) => a >= b);
    case 'in':
      return Array.isArray(right) && right.some((candidate) => candidate === left);
    case 'contains':
      return containsValue(left, right);
    default:
      throw new PolicyConditionEvaluationError(`Unsupported comparison operator: ${operator}.`);
  }
}

function compareOrdered(
  left: unknown,
  right: unknown,
  comparator: (left: number | string, right: number | string) => boolean,
): boolean {
  if (typeof left === 'number' && typeof right === 'number') {
    return comparator(left, right);
  }
  if (typeof left === 'string' && typeof right === 'string') {
    return comparator(left, right);
  }
  return false;
}

function containsValue(left: unknown, right: unknown): boolean {
  if (typeof left === 'string' && typeof right === 'string') {
    return left.includes(right);
  }
  if (Array.isArray(left)) {
    return left.some((candidate) => candidate === right);
  }
  return false;
}

function resolveIdentifierPath(
  path: readonly string[],
  context: Readonly<Record<string, unknown>>,
  budget: OperationBudget,
): unknown {
  let current: unknown = context;
  for (const segment of path) {
    budget.consume();
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toBoolean(value: unknown, message: string): boolean {
  if (typeof value !== 'boolean') {
    throw new PolicyConditionEvaluationError(message);
  }
  return value;
}
