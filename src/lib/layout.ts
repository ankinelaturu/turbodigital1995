import type { AST } from './parse';
import { collectVariables } from './parse';
import type {
  CircuitLayout,
  GateLayout,
  GateType,
  LabelLayout,
  Point,
  RailLayout,
  WireLayout,
} from './types';
import { LAYOUT } from './types';

interface NodeResult {
  point: Point;
  gates: GateLayout[];
  wires: WireLayout[];
}

let wireId = 0;
let gateId = 0;

function nextWireId(): string {
  return `w${wireId++}`;
}

function nextGateId(): string {
  return `g${gateId++}`;
}

function railX(varIndex: number): number {
  return LAYOUT.marginX + varIndex * LAYOUT.railSpacing;
}

function makeHorizontalWire(
  from: Point,
  toX: number,
  railColumns: Map<string, number>,
  sourceVar?: string,
): WireLayout {
  const y = from.y;
  const x1 = Math.min(from.x, toX);
  const x2 = Math.max(from.x, toX);
  const jumpers: { x: number; y: number; railX: number }[] = [];

  for (const [name, col] of railColumns) {
    if (sourceVar === name) continue;
    const rx = railX(col);
    if (rx > x1 + 4 && rx < x2 - 4) {
      jumpers.push({ x: rx, y, railX: rx });
    }
  }

  return {
    id: nextWireId(),
    points: [
      { x: from.x, y },
      { x: toX, y },
    ],
    jumpers,
  };
}

function layoutNode(
  ast: AST,
  railColumns: Map<string, number>,
  yCursor: { value: number },
): NodeResult {
  switch (ast.type) {
    case 'var': {
      const col = railColumns.get(ast.name)!;
      const x = railX(col);
      const y = yCursor.value;
      yCursor.value += LAYOUT.rowStep;
      return { point: { x, y }, gates: [], wires: [] };
    }
    case 'not': {
      const child = layoutNode(ast.child, railColumns, yCursor);
      const gateX = child.point.x + LAYOUT.layerSpacing;
      const gateY = child.point.y;
      const inputX = gateX - LAYOUT.notWidth;
      const wires = [...child.wires];

      wires.push(
        makeHorizontalWire(
          child.point,
          inputX,
          railColumns,
          ast.child.type === 'var' ? ast.child.name : undefined,
        ),
      );

      const gate: GateLayout = {
        id: nextGateId(),
        type: 'NOT',
        x: gateX - LAYOUT.notWidth,
        y: gateY - LAYOUT.notHeight / 2,
        inputYs: [gateY],
        outputX: gateX + 4,
        outputY: gateY,
      };

      return {
        point: { x: gate.outputX, y: gateY },
        gates: [...child.gates, gate],
        wires,
      };
    }
    case 'and':
    case 'or': {
      const left = layoutNode(ast.left, railColumns, yCursor);
      const right = layoutNode(ast.right, railColumns, yCursor);

      const maxChildX = Math.max(left.point.x, right.point.x);
      const gateX = maxChildX + LAYOUT.layerSpacing;
      const gateY = (left.point.y + right.point.y) / 2;
      const inputX = gateX - LAYOUT.gateWidth;

      const wires = [...left.wires, ...right.wires];

      const leftVar = ast.left.type === 'var' ? ast.left.name : undefined;
      const rightVar = ast.right.type === 'var' ? ast.right.name : undefined;

      wires.push(makeHorizontalWire(left.point, inputX, railColumns, leftVar));
      wires.push(makeHorizontalWire(right.point, inputX, railColumns, rightVar));

      const gateType: GateType = ast.type === 'and' ? 'AND' : 'OR';
      const gate: GateLayout = {
        id: nextGateId(),
        type: gateType,
        x: gateX - LAYOUT.gateWidth,
        y: gateY - LAYOUT.gateHeight / 2,
        inputYs: [left.point.y, right.point.y],
        outputX: gateX + 8,
        outputY: gateY,
      };

      return {
        point: { x: gate.outputX, y: gateY },
        gates: [...left.gates, ...right.gates, gate],
        wires,
      };
    }
  }
}

export function buildLayout(ast: AST): CircuitLayout {
  wireId = 0;
  gateId = 0;

  const variables = collectVariables(ast);
  const railColumns = new Map<string, number>();
  variables.forEach((v, i) => railColumns.set(v, i));

  const yCursor = { value: LAYOUT.railTop + 40 };
  const result = layoutNode(ast, railColumns, yCursor);

  const yBottom = Math.max(yCursor.value + 40, LAYOUT.railTop + 200);
  const rails: RailLayout[] = variables.map((name, i) => ({
    name,
    x: railX(i),
    yTop: LAYOUT.railTop,
    yBottom,
  }));

  const labels: LabelLayout[] = variables.map((name, i) => ({
    text: name,
    x: railX(i),
    y: LAYOUT.railTop + LAYOUT.labelOffsetY,
  }));

  const gates = result.gates;
  const wires: WireLayout[] = [...result.wires];

  const outputX = result.point.x + 60;
  const output: Point = { x: outputX, y: result.point.y };

  wires.push({
    id: nextWireId(),
    points: [result.point, output],
    jumpers: [],
  });

  const width = outputX + 80;
  const height = yBottom + 60;

  return {
    variables,
    rails,
    gates,
    wires,
    labels,
    output,
    width,
    height,
  };
}
