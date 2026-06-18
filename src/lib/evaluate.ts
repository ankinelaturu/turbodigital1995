import type { AST } from './parse';

export function evaluate(ast: AST, env: Record<string, boolean>): boolean {
  switch (ast.type) {
    case 'var':
      return env[ast.name] ?? false;
    case 'not':
      return !evaluate(ast.child, env);
    case 'and':
      return evaluate(ast.left, env) && evaluate(ast.right, env);
    case 'or':
      return evaluate(ast.left, env) || evaluate(ast.right, env);
    case 'xor':
      return evaluate(ast.left, env) !== evaluate(ast.right, env);
  }
}

export interface TruthTableRow {
  inputs: Record<string, boolean>;
  output: boolean;
}

export function buildTruthTable(ast: AST, variables: string[]): TruthTableRow[] {
  const n = variables.length;
  const rows: TruthTableRow[] = [];
  const count = 1 << n;
  for (let i = 0; i < count; i++) {
    const inputs: Record<string, boolean> = {};
    for (let v = 0; v < n; v++) {
      inputs[variables[v]] = ((i >> (n - 1 - v)) & 1) === 1;
    }
    rows.push({ inputs, output: evaluate(ast, inputs) });
  }
  return rows;
}
