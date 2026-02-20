import {
  PolicyConditionSyntaxError,
  type BinaryOperator,
  type ExpressionNode,
  type Token,
  type TokenType,
} from './policy-condition-dsl-v1.types.js';
import { tokenizePolicyConditionDslV1 } from './policy-condition-dsl-v1.tokenizer.js';

export function parsePolicyConditionDslAstV1(source: string): ExpressionNode {
  if (typeof source !== 'string' || source.trim() === '') {
    throw new PolicyConditionSyntaxError('condition must be a non-empty string.');
  }

  const parser = new PolicyConditionParser(tokenizePolicyConditionDslV1(source));
  return parser.parse();
}

class PolicyConditionParser {
  readonly #tokens: readonly Token[];
  #cursor = 0;

  public constructor(tokens: readonly Token[]) {
    this.#tokens = tokens;
  }

  public parse(): ExpressionNode {
    const expression = this.#parseOr();
    this.#expect('eof', 'Unexpected token after the end of condition expression.');
    return expression;
  }

  #parseOr(): ExpressionNode {
    let left = this.#parseAnd();
    while (this.#match('or')) {
      left = {
        kind: 'binary',
        operator: 'or',
        left,
        right: this.#parseAnd(),
      };
    }
    return left;
  }

  #parseAnd(): ExpressionNode {
    let left = this.#parseComparison();
    while (this.#match('and')) {
      left = {
        kind: 'binary',
        operator: 'and',
        left,
        right: this.#parseComparison(),
      };
    }
    return left;
  }

  #parseComparison(): ExpressionNode {
    const left = this.#parseUnary();
    const operator = this.#readComparisonOperator();
    if (operator === null) return left;
    this.#advance();
    return {
      kind: 'binary',
      operator,
      left,
      right: this.#parseUnary(),
    };
  }

  #parseUnary(): ExpressionNode {
    if (this.#match('not')) {
      return {
        kind: 'unary',
        operator: 'not',
        operand: this.#parseUnary(),
      };
    }
    return this.#parsePrimary();
  }

  #parsePrimary(): ExpressionNode {
    const token = this.#peek();
    if (token.type === 'identifier') {
      this.#advance();
      return {
        kind: 'identifier',
        path: String(token.value).split('.'),
      };
    }

    if (
      token.type === 'string' ||
      token.type === 'number' ||
      token.type === 'boolean' ||
      token.type === 'null'
    ) {
      this.#advance();
      return {
        kind: 'literal',
        value: token.value ?? null,
      };
    }

    if (token.type === 'lparen') {
      this.#advance();
      const expression = this.#parseOr();
      this.#expect('rparen', 'Missing closing parenthesis.');
      return expression;
    }

    throw new PolicyConditionSyntaxError(
      `Unexpected token '${token.lexeme}' at position ${token.position}.`,
    );
  }

  #readComparisonOperator(): BinaryOperator | null {
    const token = this.#peek();
    switch (token.type) {
      case 'eq':
      case 'neq':
      case 'lt':
      case 'lte':
      case 'gt':
      case 'gte':
      case 'in':
      case 'contains':
        return token.type;
      default:
        return null;
    }
  }

  #match(type: TokenType): boolean {
    if (this.#peek().type !== type) return false;
    this.#advance();
    return true;
  }

  #expect(type: TokenType, message: string): void {
    if (this.#peek().type !== type) {
      throw new PolicyConditionSyntaxError(message);
    }
    this.#advance();
  }

  #peek(): Token {
    return this.#tokens[this.#cursor] ?? this.#tokens[this.#tokens.length - 1]!;
  }

  #advance(): Token {
    const token = this.#peek();
    this.#cursor += 1;
    return token;
  }
}
