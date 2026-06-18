import { OUTPUT_NAME } from './types';

export type AST =
  | { type: 'var'; name: string }
  | { type: 'not'; child: AST }
  | { type: 'and'; left: AST; right: AST }
  | { type: 'or'; left: AST; right: AST };

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

function normalize(expr: string): string {
  return expr
    .replace(/\s+/g, '')
    .replace(/·/g, '*')
    .replace(/&/g, '*')
    .replace(/\|/g, '+')
    .replace(/NOT/gi, '!')
    .replace(/AND/gi, '*')
    .replace(/OR/gi, '+');
}

export function parse(expr: string): AST {
  const tokens = tokenize(normalize(expr));
  if (tokens.length === 0) throw new ParseError('Empty expression');
  const [ast, rest] = parseOr(tokens);
  if (rest.length > 0) {
    throw new ParseError(`Unexpected token: ${rest[0]}`);
  }
  return ast;
}

type Token =
  | { kind: 'var'; name: string }
  | { kind: 'not' }
  | { kind: 'and' }
  | { kind: 'or' }
  | { kind: 'lparen' }
  | { kind: 'rparen' };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === '(') {
      tokens.push({ kind: 'lparen' });
      i++;
    } else if (ch === ')') {
      tokens.push({ kind: 'rparen' });
      i++;
    } else if (ch === '!' || ch === "'") {
      tokens.push({ kind: 'not' });
      i++;
    } else if (ch === '*' || ch === '.') {
      tokens.push({ kind: 'and' });
      i++;
    } else if (ch === '+') {
      tokens.push({ kind: 'or' });
      i++;
    } else if (/[A-Za-z]/.test(ch)) {
      let name = ch.toUpperCase();
      i++;
      while (i < input.length && /[A-Za-z0-9]/.test(input[i])) {
        name += input[i].toUpperCase();
        i++;
      }
      if (name === OUTPUT_NAME) {
        throw new ParseError(
          `${OUTPUT_NAME} is reserved for the circuit output; use A–Y as inputs`,
        );
      }
      tokens.push({ kind: 'var', name });
    } else {
      throw new ParseError(`Invalid character: ${ch}`);
    }
  }
  return tokens;
}

function parseOr(tokens: Token[]): [AST, Token[]] {
  let [left, rest] = parseAnd(tokens);
  while (rest.length > 0 && rest[0].kind === 'or') {
    const [, afterOr] = [rest[0], rest.slice(1)] as const;
    const [right, afterRight] = parseAnd(afterOr);
    left = { type: 'or', left, right };
    rest = afterRight;
  }
  return [left, rest];
}

function parseAnd(tokens: Token[]): [AST, Token[]] {
  let [left, rest] = parseUnary(tokens);
  while (rest.length > 0) {
    if (rest[0].kind === 'and') {
      const [right, afterRight] = parseUnary(rest.slice(1));
      left = { type: 'and', left, right };
      rest = afterRight;
    } else if (rest[0].kind === 'var' || rest[0].kind === 'not' || rest[0].kind === 'lparen') {
      const [right, afterRight] = parseUnary(rest);
      left = { type: 'and', left, right };
      rest = afterRight;
    } else {
      break;
    }
  }
  return [left, rest];
}

function parseUnary(tokens: Token[]): [AST, Token[]] {
  if (tokens.length === 0) throw new ParseError('Expected operand');
  if (tokens[0].kind === 'not') {
    const [child, rest] = parseUnary(tokens.slice(1));
    return [{ type: 'not', child }, rest];
  }
  return parsePrimaryWithPostfix(tokens);
}

function parsePrimaryWithPostfix(tokens: Token[]): [AST, Token[]] {
  const [primary, rest0] = parsePrimary(tokens);
  let node = primary;
  let rest = rest0;
  while (rest.length > 0 && rest[0].kind === 'not') {
    node = { type: 'not', child: node };
    rest = rest.slice(1);
  }
  return [node, rest];
}

function parsePrimary(tokens: Token[]): [AST, Token[]] {
  if (tokens.length === 0) throw new ParseError('Expected operand');
  if (tokens[0].kind === 'var') {
    return [{ type: 'var', name: tokens[0].name }, tokens.slice(1)];
  }
  if (tokens[0].kind === 'lparen') {
    const [inner, rest] = parseOr(tokens.slice(1));
    if (rest.length === 0 || rest[0].kind !== 'rparen') {
      throw new ParseError('Missing closing parenthesis');
    }
    return [inner, rest.slice(1)];
  }
  throw new ParseError('Expected variable or parenthesis');
}

export function collectVariables(ast: AST): string[] {
  const set = new Set<string>();
  walk(ast, set);
  set.delete(OUTPUT_NAME);
  return [...set].sort();
}

function walk(ast: AST, set: Set<string>): void {
  switch (ast.type) {
    case 'var':
      set.add(ast.name);
      break;
    case 'not':
      walk(ast.child, set);
      break;
    case 'and':
    case 'or':
      walk(ast.left, set);
      walk(ast.right, set);
      break;
  }
}
