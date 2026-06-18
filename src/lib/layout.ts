import type { AST } from './parse';
import { collectVariables, formatExpression } from './parse';
import type {
  CircuitLayout,
  GateLayout,
  GateType,
  LabelLayout,
  Point,
  RailLayout,
  WireLayout,
  WireSegmentLayout,
} from './types';
import { LAYOUT } from './types';
import { buildGatePins } from './gateGeometry';

interface NodeResult {
  point: Point;
  gates: GateLayout[];
  wires: WireLayout[];
  /** Deepest gate layer in this subtree; 0 for a bare variable */
  depth: number;
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

function gateColumnX(gateZoneStartX: number, depth: number): number {
  return gateZoneStartX + (depth - 1) * LAYOUT.layerSpacing;
}

function collectRailJumpers(
  x1: number,
  x2: number,
  y: number,
  railColumns: Map<string, number>,
  sourceVar?: string,
): { x: number; y: number; railX: number }[] {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const jumpers: { x: number; y: number; railX: number }[] = [];

  for (const [name, col] of railColumns) {
    if (sourceVar === name) continue;
    const rx = railX(col);
    if (rx > minX + 4 && rx < maxX - 4) {
      jumpers.push({ x: rx, y, railX: rx });
    }
  }
  return jumpers;
}

/** Horizontal → vertical → horizontal to input pin outer endpoint */
function makeOrthogonalWireToGate(
  from: Point,
  pinOuterX: number,
  pinOuterY: number,
  railColumns: Map<string, number>,
  sourceVar?: string,
): WireLayout {
  const stub = LAYOUT.gateWireStub;
  const stubX = pinOuterX - stub;
  const segments: WireSegmentLayout[] = [];

  if (Math.abs(from.x - stubX) > 0.5) {
    segments.push({
      points: [
        { x: from.x, y: from.y },
        { x: stubX, y: from.y },
      ],
      jumpers: collectRailJumpers(from.x, stubX, from.y, railColumns, sourceVar),
    });
  }

  if (Math.abs(from.y - pinOuterY) > 0.5) {
    segments.push({
      points: [
        { x: stubX, y: from.y },
        { x: stubX, y: pinOuterY },
      ],
      jumpers: [],
    });
  }

  if (Math.abs(stubX - pinOuterX) > 0.5) {
    segments.push({
      points: [
        { x: stubX, y: pinOuterY },
        { x: pinOuterX, y: pinOuterY },
      ],
      jumpers: [],
    });
  }

  return { id: nextWireId(), segments };
}

function layoutNode(
  ast: AST,
  railColumns: Map<string, number>,
  gateZoneStartX: number,
  yCursor: { value: number },
): NodeResult {
  switch (ast.type) {
    case 'var': {
      const col = railColumns.get(ast.name)!;
      const x = railX(col);
      const y = yCursor.value;
      yCursor.value += LAYOUT.rowStep;
      return { point: { x, y }, gates: [], wires: [], depth: 0 };
    }
    case 'not': {
      const child = layoutNode(ast.child, railColumns, gateZoneStartX, yCursor);
      const depth = child.depth + 1;
      const bodyX = gateColumnX(gateZoneStartX, depth);
      const gateY = child.point.y;
      const pins = buildGatePins('NOT', bodyX, 0, gateY);
      const wires = [...child.wires];

      wires.push(
        makeOrthogonalWireToGate(
          child.point,
          pins.inputOuter[0].x,
          pins.inputOuter[0].y,
          railColumns,
          ast.child.type === 'var' ? ast.child.name : undefined,
        ),
      );

      const gate: GateLayout = {
        id: nextGateId(),
        type: 'NOT',
        x: pins.body.x,
        y: pins.body.y,
        inputYs: pins.inputOuter.map((p) => p.y),
        outputX: pins.outputOuter.x,
        outputY: pins.outputOuter.y,
        expression: formatExpression(ast),
      };

      return {
        point: pins.outputOuter,
        gates: [...child.gates, gate],
        wires,
        depth,
      };
    }
    case 'and':
    case 'or': {
      const left = layoutNode(ast.left, railColumns, gateZoneStartX, yCursor);
      const right = layoutNode(ast.right, railColumns, gateZoneStartX, yCursor);

      const depth = Math.max(left.depth, right.depth) + 1;
      const bodyX = gateColumnX(gateZoneStartX, depth);
      const gateY = (left.point.y + right.point.y) / 2;
      const gateTop = gateY - LAYOUT.gateHeight / 2;
      const gateType: GateType = ast.type === 'and' ? 'AND' : 'OR';
      const pins = buildGatePins(gateType, bodyX, gateTop);

      const wires = [...left.wires, ...right.wires];

      const leftVar = ast.left.type === 'var' ? ast.left.name : undefined;
      const rightVar = ast.right.type === 'var' ? ast.right.name : undefined;

      const upperFrom = left.point.y <= right.point.y ? left.point : right.point;
      const lowerFrom = left.point.y <= right.point.y ? right.point : left.point;
      const upperVar = left.point.y <= right.point.y ? leftVar : rightVar;
      const lowerVar = left.point.y <= right.point.y ? rightVar : leftVar;

      wires.push(
        makeOrthogonalWireToGate(
          upperFrom,
          pins.inputOuter[0].x,
          pins.inputOuter[0].y,
          railColumns,
          upperVar,
        ),
      );
      wires.push(
        makeOrthogonalWireToGate(
          lowerFrom,
          pins.inputOuter[1].x,
          pins.inputOuter[1].y,
          railColumns,
          lowerVar,
        ),
      );

      const gate: GateLayout = {
        id: nextGateId(),
        type: gateType,
        x: pins.body.x,
        y: pins.body.y,
        inputYs: pins.inputOuter.map((p) => p.y),
        outputX: pins.outputOuter.x,
        outputY: pins.outputOuter.y,
        expression: formatExpression(ast),
      };

      return {
        point: pins.outputOuter,
        gates: [...left.gates, ...right.gates, gate],
        wires,
        depth,
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

  const lastRailX = variables.length > 0 ? railX(variables.length - 1) : LAYOUT.marginX;
  const gateZoneStartX = lastRailX + LAYOUT.railToGateGap;

  const yCursor = { value: LAYOUT.railTop + 40 };
  const result = layoutNode(ast, railColumns, gateZoneStartX, yCursor);

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
    segments: [
      {
        points: [result.point, output],
        jumpers: [],
      },
    ],
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
