import {
  PolicyConditionSyntaxError,
  type Token,
  type TokenType,
} from './policy-condition-dsl-v1.types.js';

const PUNCTUATION_TOKENS: readonly Readonly<{ lexeme: string; type: TokenType }>[] = [
  { lexeme: '!==', type: 'neq' },
  { lexeme: '===', type: 'eq' },
  { lexeme: '&&', type: 'and' },
  { lexeme: '||', type: 'or' },
  { lexeme: '!=', type: 'neq' },
  { lexeme: '==', type: 'eq' },
  { lexeme: '<=', type: 'lte' },
  { lexeme: '>=', type: 'gte' },
  { lexeme: '<', type: 'lt' },
  { lexeme: '>', type: 'gt' },
  { lexeme: '!', type: 'not' },
  { lexeme: '(', type: 'lparen' },
  { lexeme: ')', type: 'rparen' },
];

const NUMBER_LITERAL_RE = /^-?\d+(?:\.\d+)?/;
const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_.]*/;

export function tokenizePolicyConditionDslV1(source: string): readonly Token[] {
  const tokens: Token[] = [];
  let cursor = 0;

  while (cursor < source.length) {
    const char = source[cursor]!;
    if (isWhitespace(char)) {
      cursor += 1;
      continue;
    }

    const punctuation = readPunctuationToken(source, cursor);
    if (punctuation) {
      tokens.push(punctuation.token);
      cursor = punctuation.next;
      continue;
    }

    const stringToken = readStringToken(source, cursor);
    if (stringToken) {
      tokens.push(stringToken.token);
      cursor = stringToken.next;
      continue;
    }

    const numberToken = readNumberToken(source, cursor);
    if (numberToken) {
      tokens.push(numberToken.token);
      cursor = numberToken.next;
      continue;
    }

    const identifierToken = readIdentifierToken(source, cursor);
    if (identifierToken) {
      tokens.push(identifierToken.token);
      cursor = identifierToken.next;
      continue;
    }

    throw new PolicyConditionSyntaxError(`Unsupported token '${char}' at position ${cursor}.`);
  }

  tokens.push({
    type: 'eof',
    lexeme: '',
    position: source.length,
  });
  return tokens;
}

function readPunctuationToken(
  source: string,
  cursor: number,
): Readonly<{ token: Token; next: number }> | null {
  for (const mapping of PUNCTUATION_TOKENS) {
    if (source.startsWith(mapping.lexeme, cursor)) {
      return {
        token: {
          type: mapping.type,
          lexeme: mapping.lexeme,
          position: cursor,
        },
        next: cursor + mapping.lexeme.length,
      };
    }
  }
  return null;
}

function readStringToken(
  source: string,
  cursor: number,
): Readonly<{ token: Token; next: number }> | null {
  const quote = source[cursor];
  if (quote !== '"' && quote !== "'") return null;

  let index = cursor + 1;
  let value = '';
  while (index < source.length) {
    const char = source[index]!;
    if (char === '\\') {
      const escaped = source[index + 1];
      if (escaped === undefined) {
        throw new PolicyConditionSyntaxError(`Unterminated escape sequence at position ${index}.`);
      }
      value += unescapeStringChar(escaped);
      index += 2;
      continue;
    }
    if (char === quote) {
      return {
        token: {
          type: 'string',
          lexeme: source.slice(cursor, index + 1),
          position: cursor,
          value,
        },
        next: index + 1,
      };
    }
    value += char;
    index += 1;
  }

  throw new PolicyConditionSyntaxError(`Unterminated string literal at position ${cursor}.`);
}

function readNumberToken(
  source: string,
  cursor: number,
): Readonly<{ token: Token; next: number }> | null {
  const match = NUMBER_LITERAL_RE.exec(source.slice(cursor));
  if (!match) return null;
  const lexeme = match[0];
  const value = Number(lexeme);
  if (!Number.isFinite(value)) {
    throw new PolicyConditionSyntaxError(`Invalid number literal '${lexeme}' at ${cursor}.`);
  }

  return {
    token: {
      type: 'number',
      lexeme,
      position: cursor,
      value,
    },
    next: cursor + lexeme.length,
  };
}

function readIdentifierToken(
  source: string,
  cursor: number,
): Readonly<{ token: Token; next: number }> | null {
  const match = IDENTIFIER_RE.exec(source.slice(cursor));
  if (!match) return null;
  const lexeme = match[0];
  if (!isValidIdentifierPath(lexeme)) {
    throw new PolicyConditionSyntaxError(`Invalid identifier '${lexeme}' at position ${cursor}.`);
  }

  const keyword = toKeywordToken(lexeme, cursor);
  return {
    token:
      keyword ??
      ({
        type: 'identifier',
        lexeme,
        position: cursor,
        value: lexeme,
      } satisfies Token),
    next: cursor + lexeme.length,
  };
}

function toKeywordToken(lexeme: string, position: number): Token | null {
  switch (lexeme) {
    case 'and':
      return { type: 'and', lexeme, position };
    case 'or':
      return { type: 'or', lexeme, position };
    case 'not':
      return { type: 'not', lexeme, position };
    case 'in':
      return { type: 'in', lexeme, position };
    case 'contains':
      return { type: 'contains', lexeme, position };
    case 'true':
      return { type: 'boolean', lexeme, position, value: true };
    case 'false':
      return { type: 'boolean', lexeme, position, value: false };
    case 'null':
      return { type: 'null', lexeme, position, value: null };
    default:
      return null;
  }
}

function isValidIdentifierPath(value: string): boolean {
  if (value.startsWith('.') || value.endsWith('.') || value.includes('..')) return false;
  return value.split('.').every((segment) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(segment));
}

function unescapeStringChar(value: string): string {
  switch (value) {
    case 'n':
      return '\n';
    case 'r':
      return '\r';
    case 't':
      return '\t';
    case '\\':
      return '\\';
    case '"':
      return '"';
    case "'":
      return "'";
    default:
      return value;
  }
}

function isWhitespace(value: string): boolean {
  return /\s/u.test(value);
}
