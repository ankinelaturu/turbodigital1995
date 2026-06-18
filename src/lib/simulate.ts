import type { AST } from './parse';
import { evaluate } from './evaluate';
import type { CircuitLayout } from './types';

export function segmentKey(wireId: string, segIndex: number): string {
  return `${wireId}:${segIndex}`;
}

export interface SimulationState {
  output: boolean;
  activeRails: Set<string>;
  activeSegments: Set<string>;
}

function collectGateAsts(ast: AST): AST[] {
  switch (ast.type) {
    case 'var':
      return [];
    case 'not':
      return [...collectGateAsts(ast.child), ast];
    case 'and':
    case 'or':
    case 'xor':
      return [...collectGateAsts(ast.left), ...collectGateAsts(ast.right), ast];
  }
}

export function computeSimulation(
  ast: AST,
  layout: CircuitLayout,
  inputs: Record<string, boolean>,
): SimulationState {
  const gateAsts = collectGateAsts(ast);
  const gateValues = new Map<string, boolean>();
  layout.gates.forEach((g, i) => {
    gateValues.set(g.id, evaluate(gateAsts[i], inputs));
  });

  const output = evaluate(ast, inputs);
  const activeRails = new Set<string>();
  for (const rail of layout.rails) {
    if (inputs[rail.name]) activeRails.add(rail.name);
  }

  const activeSegments = new Set<string>();
  for (const wire of layout.wires) {
    let high = false;
    if (wire.fromVar) {
      high = inputs[wire.fromVar] ?? false;
    } else if (wire.fromGateId) {
      high = gateValues.get(wire.fromGateId) ?? false;
    } else if (wire.isOutput) {
      high = output;
    }

    if (high) {
      wire.segments.forEach((_seg, si) => {
        activeSegments.add(segmentKey(wire.id, si));
      });
    }
  }

  return { output, activeRails, activeSegments };
}

export function segmentDelta(
  prev: Set<string>,
  next: Set<string>,
): { added: Set<string>; removed: Set<string> } {
  const added = new Set<string>();
  const removed = new Set<string>();
  for (const s of next) if (!prev.has(s)) added.add(s);
  for (const s of prev) if (!next.has(s)) removed.add(s);
  return { added, removed };
}

export function defaultInputs(variables: string[]): Record<string, boolean> {
  const inputs: Record<string, boolean> = {};
  for (const v of variables) inputs[v] = false;
  return inputs;
}
