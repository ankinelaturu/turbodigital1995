/**
 * Interactive simulation: which rails, wire segments, and gates are logically HIGH.
 *
 * Gate order from `collectGateAsts` matches `layout.gates` (post-order AST walk).
 * Segment activity is derived from wire metadata tagged during layout.
 */
import type { AST } from './parse';
import { evaluate } from './evaluate';
import type { CircuitLayout } from './types';

/** Stable id for a wire segment — used for flow-animation deltas. */
export function segmentKey(wireId: string, segIndex: number): string {
  return `${wireId}:${segIndex}`;
}

export interface SimulationState {
  output: boolean;
  activeRails: Set<string>;
  activeSegments: Set<string>;
  /** Gate ids whose evaluated output is HIGH */
  activeGates: Set<string>;
}

/** Post-order gate list — index *i* aligns with `layout.gates[i]`. */
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

/** Evaluate all gate outputs and derive lit rails, wires, and active gate ids. */
export function computeSimulation(
  ast: AST,
  layout: CircuitLayout,
  inputs: Record<string, boolean>,
): SimulationState {
  const gateAsts = collectGateAsts(ast);
  const gateValues = new Map<string, boolean>();
  const activeGates = new Set<string>();
  layout.gates.forEach((g, i) => {
    const value = evaluate(gateAsts[i], inputs);
    gateValues.set(g.id, value);
    if (value) activeGates.add(g.id);
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

  return { output, activeRails, activeSegments, activeGates };
}

/** Diff active segment sets when inputs change — drives delta-only flow animation. */
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

/** All switches OFF — matches truth-table row 0. */
export function defaultInputs(variables: string[]): Record<string, boolean> {
  const inputs: Record<string, boolean> = {};
  for (const v of variables) inputs[v] = false;
  return inputs;
}
