import { evaluatePolicyConditionDslAstV1 } from './policy-condition-dsl-v1.evaluator.js';
import { parsePolicyConditionDslAstV1 } from './policy-condition-dsl-v1.parser.js';
import {
  PolicyConditionEvaluationError,
  type PolicyConditionEvaluationResultV1,
  type PolicyConditionExpressionV1,
  PolicyConditionSyntaxError,
  PolicyConditionTimeoutError,
} from './policy-condition-dsl-v1.types.js';

export {
  PolicyConditionEvaluationError,
  PolicyConditionSyntaxError,
  PolicyConditionTimeoutError,
  type BinaryNode,
  type BinaryOperator,
  type ExpressionNode,
  type IdentifierNode,
  type LiteralNode,
  type LiteralValue,
  type PolicyConditionEvaluationResultV1,
  type PolicyConditionExpressionV1,
  type Token,
  type TokenType,
  type UnaryNode,
} from './policy-condition-dsl-v1.types.js';

export function parsePolicyConditionDslV1(source: string): PolicyConditionExpressionV1 {
  return {
    source,
    ast: parsePolicyConditionDslAstV1(source),
  };
}

export function evaluatePolicyConditionDslV1(input: {
  condition: string;
  context: Readonly<Record<string, unknown>>;
  maxOperations?: number;
}): PolicyConditionEvaluationResultV1 {
  try {
    const parsed = parsePolicyConditionDslV1(input.condition);
    const value = evaluatePolicyConditionDslAstV1({
      ast: parsed.ast,
      context: input.context,
      maxOperations: input.maxOperations ?? 512,
    });
    return { ok: true, value };
  } catch (error) {
    if (error instanceof PolicyConditionTimeoutError) {
      return { ok: false, errorKind: 'Timeout', message: error.message };
    }
    if (error instanceof PolicyConditionSyntaxError) {
      return { ok: false, errorKind: 'ParseError', message: error.message };
    }
    if (error instanceof PolicyConditionEvaluationError) {
      return { ok: false, errorKind: 'EvaluationError', message: error.message };
    }
    return {
      ok: false,
      errorKind: 'EvaluationError',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
