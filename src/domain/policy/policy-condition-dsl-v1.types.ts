export type TokenType =
  | 'identifier'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'lparen'
  | 'rparen'
  | 'and'
  | 'or'
  | 'not'
  | 'eq'
  | 'neq'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'in'
  | 'contains'
  | 'eof';

export type Token = Readonly<{
  type: TokenType;
  lexeme: string;
  position: number;
  value?: string | number | boolean | null;
}>;

export type LiteralValue = string | number | boolean | null;

export type LiteralNode = Readonly<{ kind: 'literal'; value: LiteralValue }>;
export type IdentifierNode = Readonly<{ kind: 'identifier'; path: readonly string[] }>;
export type UnaryNode = Readonly<{ kind: 'unary'; operator: 'not'; operand: ExpressionNode }>;
export type BinaryOperator =
  | 'and'
  | 'or'
  | 'eq'
  | 'neq'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'in'
  | 'contains';
export type BinaryNode = Readonly<{
  kind: 'binary';
  operator: BinaryOperator;
  left: ExpressionNode;
  right: ExpressionNode;
}>;

export type ExpressionNode = LiteralNode | IdentifierNode | UnaryNode | BinaryNode;

export type PolicyConditionExpressionV1 = Readonly<{
  source: string;
  ast: ExpressionNode;
}>;

export type PolicyConditionEvaluationResultV1 =
  | Readonly<{ ok: true; value: boolean }>
  | Readonly<{
      ok: false;
      errorKind: 'ParseError' | 'EvaluationError' | 'Timeout';
      message: string;
    }>;

export class PolicyConditionSyntaxError extends Error {
  public override readonly name = 'PolicyConditionSyntaxError';

  public constructor(message: string) {
    super(message);
  }
}

export class PolicyConditionEvaluationError extends Error {
  public override readonly name = 'PolicyConditionEvaluationError';

  public constructor(message: string) {
    super(message);
  }
}

export class PolicyConditionTimeoutError extends Error {
  public override readonly name = 'PolicyConditionTimeoutError';

  public constructor(message: string) {
    super(message);
  }
}
