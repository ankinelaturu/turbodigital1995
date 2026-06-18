/**
 * Boolean expression parser.
 *
 * Syntax: `·` / `*` / `&` AND (also juxtaposition), `^` XOR, `+` / `|` OR,
 * `'` postfix NOT, `NOT` keyword, parentheses. Inputs A–Y; `Z` is reserved for output.
 *
 * Precedence (low → high): OR, XOR, AND, NOT. Each AST node carries a `SourceSpan`
 * for gate-hover ↔ expression highlighting.
 */
import { OUTPUT_NAME } from './types';

export interface SourceSpan {
  start: number;
  end: number;
}

export type AST =
  | { type: 'var'; name: string; span: SourceSpan }
  | { type: 'not'; child: AST; span: SourceSpan }
  | { type: 'and'; left: AST; right: AST; span: SourceSpan }
  | { type: 'xor'; left: AST; right: AST; span: SourceSpan }
  | { type: 'or'; left: AST; right: AST; span: SourceSpan };

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

type Token =
  | { kind: 'var'; name: string; span: SourceSpan }
  | { kind: 'not'; span: SourceSpan }
  | { kind: 'and'; span: SourceSpan }
  | { kind: 'xor'; span: SourceSpan }
  | { kind: 'or'; span: SourceSpan }
  | { kind: 'lparen'; span: SourceSpan }
  | { kind: 'rparen'; span: SourceSpan };

function mergeSpan(a: SourceSpan, b: SourceSpan): SourceSpan {
  return { start: a.start, end: b.end };
}

function readKeyword(
  input: string,
  i: number,
): { kind: 'not' | 'and' | 'xor' | 'or'; len: number } | null {
  const tail = input.slice(i);
  if (/^NOT\b/i.test(tail)) return { kind: 'not', len: 3 };
  if (/^AND\b/i.test(tail)) return { kind: 'and', len: 3 };
  if (/^XOR\b/i.test(tail)) return { kind: 'xor', len: 3 };
  if (/^OR\b/i.test(tail)) return { kind: 'or', len: 2 };
  return null;
}

/** Lex the input string; rejects `Z` as an input variable. */
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    if (/\s/.test(input[i])) {
      i++;
      continue;
    }

    const keyword = readKeyword(input, i);
    if (keyword) {
      tokens.push({
        kind: keyword.kind,
        span: { start: i, end: i + keyword.len },
      });
      i += keyword.len;
      continue;
    }

    const ch = input[i];
    const start = i;

    if (ch === '(') {
      tokens.push({ kind: 'lparen', span: { start, end: i + 1 } });
      i++;
    } else if (ch === ')') {
      tokens.push({ kind: 'rparen', span: { start, end: i + 1 } });
      i++;
    } else if (ch === "'") {
      tokens.push({ kind: 'not', span: { start, end: i + 1 } });
      i++;
    } else if (ch === '*' || ch === '.' || ch === '·' || ch === '&') {
      tokens.push({ kind: 'and', span: { start, end: i + 1 } });
      i++;
    } else if (ch === '+' || ch === '|') {
      tokens.push({ kind: 'or', span: { start, end: i + 1 } });
      i++;
    } else if (ch === '^') {
      tokens.push({ kind: 'xor', span: { start, end: i + 1 } });
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
      tokens.push({ kind: 'var', name, span: { start, end: i } });
    } else {
      throw new ParseError(`Invalid character: ${ch}`);
    }
  }

  return tokens;
}

/** Entry point — returns the root AST or throws `ParseError`. */
export function parse(expr: string): AST {
  const tokens = tokenize(expr);
  if (tokens.length === 0) throw new ParseError('Empty expression');
  const [ast, rest] = parseOr(tokens);
  if (rest.length > 0) {
    throw new ParseError(`Unexpected token: ${rest[0].kind}`);
  }
  return ast;
}

function parseOr(tokens: Token[]): [AST, Token[]] {
  let [left, rest] = parseXor(tokens);
  while (rest.length > 0 && rest[0].kind === 'or') {
    const [right, afterRight] = parseXor(rest.slice(1));
    left = {
      type: 'or',
      left,
      right,
      span: mergeSpan(left.span, right.span),
    };
    rest = afterRight;
  }
  return [left, rest];
}

function parseXor(tokens: Token[]): [AST, Token[]] {
  let [left, rest] = parseAnd(tokens);
  while (rest.length > 0 && rest[0].kind === 'xor') {
    const [right, afterRight] = parseAnd(rest.slice(1));
    left = {
      type: 'xor',
      left,
      right,
      span: mergeSpan(left.span, right.span),
    };
    rest = afterRight;
  }
  return [left, rest];
}

function parseAnd(tokens: Token[]): [AST, Token[]] {
  let [left, rest] = parseUnary(tokens);
  while (rest.length > 0) {
    if (rest[0].kind === 'and') {
      const [right, afterRight] = parseUnary(rest.slice(1));
      left = {
        type: 'and',
        left,
        right,
        span: mergeSpan(left.span, right.span),
      };
      rest = afterRight;
    } else if (rest[0].kind === 'var' || rest[0].kind === 'not' || rest[0].kind === 'lparen') {
      // Implicit AND: `A B` or `A(B+C)` without an explicit operator
      const [right, afterRight] = parseUnary(rest);
      left = {
        type: 'and',
        left,
        right,
        span: mergeSpan(left.span, right.span),
      };
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
    const notSpan = tokens[0].span;
    const [child, rest] = parseUnary(tokens.slice(1));
    return [
      { type: 'not', child, span: mergeSpan(notSpan, child.span) },
      rest,
    ];
  }
  return parsePrimaryWithPostfix(tokens);
}

function parsePrimaryWithPostfix(tokens: Token[]): [AST, Token[]] {
  const [primary, rest0] = parsePrimary(tokens);
  let node = primary;
  let rest = rest0;
  while (rest.length > 0 && rest[0].kind === 'not') {
    node = {
      type: 'not',
      child: node,
      span: mergeSpan(node.span, rest[0].span),
    };
    rest = rest.slice(1);
  }
  return [node, rest];
}

function parsePrimary(tokens: Token[]): [AST, Token[]] {
  if (tokens.length === 0) throw new ParseError('Expected operand');
  if (tokens[0].kind === 'var') {
    const token = tokens[0];
    return [
      { type: 'var', name: token.name, span: token.span },
      tokens.slice(1),
    ];
  }
  if (tokens[0].kind === 'lparen') {
    const lparen = tokens[0].span;
    const [inner, rest] = parseOr(tokens.slice(1));
    if (rest.length === 0 || rest[0].kind !== 'rparen') {
      throw new ParseError('Missing closing parenthesis');
    }
    const rparen = rest[0].span;
    return [
      { ...inner, span: mergeSpan(lparen, rparen) },
      rest.slice(1),
    ];
  }
  throw new ParseError('Expected variable or parenthesis');
}

export function collectVariables(ast: AST): string[] {
  const set = new Set<string>();
  walk(ast, set);
  set.delete(OUTPUT_NAME);
  return [...set].sort();
}

/** Display string for tooltips (middle-dot AND, ^ XOR, + OR, postfix NOT). */
export function formatExpression(
  ast: AST,
  parent?: 'and' | 'xor' | 'or',
): string {
  switch (ast.type) {
    case 'var':
      return ast.name;
    case 'not':
      if (ast.child.type === 'var') return `${ast.child.name}'`;
      return `(${formatExpression(ast.child)})'`;
    case 'and': {
      const text = `${formatExpression(ast.left, 'and')}·${formatExpression(ast.right, 'and')}`;
      return parent === 'or' || parent === 'xor' ? `(${text})` : text;
    }
    case 'xor': {
      const text = `${formatExpression(ast.left, 'xor')}^${formatExpression(ast.right, 'xor')}`;
      return parent === 'or' || parent === 'and' ? `(${text})` : text;
    }
    case 'or': {
      const text = `${formatExpression(ast.left, 'or')}+${formatExpression(ast.right, 'or')}`;
      return parent === 'and' || parent === 'xor' ? `(${text})` : text;
    }
  }
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
    case 'xor':
    case 'or':
      walk(ast.left, set);
      walk(ast.right, set);
      break;
  }
}
