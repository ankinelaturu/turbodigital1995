/**
 * AST → `CircuitLayout`: vertical input rails, orthogonal wires, gate columns by depth.
 *
 * Layout mirrors AST structure recursively. `drawSteps` interleaves wires and gates in
 * evaluation order so the pen animation follows signal flow. Wire metadata (`fromVar`,
 * `fromGateId`, etc.) feeds `simulate.ts`.
 */
import type { AST } from './parse';
import { collectVariables, formatExpression } from './parse';
import type {
  CircuitLayout,
  DrawStep,
  GateLayout,
  GateType,
  LabelLayout,
  Point,
  RailLayout,
  VarTapLayout,
  WireLayout,
  WireSegmentLayout,
} from './types';
import { LAYOUT } from './types';
import { buildGatePins } from './gateGeometry';

/**
 * Result of laying out one AST subtree — output tap point plus accumulated geometry.
 */
interface NodeResult {
  point: Point;
  gates: GateLayout[];
  wires: WireLayout[];
  drawSteps: DrawStep[];
  varTaps: VarTapLayout[];
  /**
   * Deepest gate layer in this subtree; 0 for a bare variable.
   */
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

/**
 * Places arc jumpers on horizontal segments that cross other input rails.
 * Skips the rail the wire originated from (`sourceVar`).
 */
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

/**
 * Horizontal → vertical → horizontal to input pin outer endpoint.
 */
function makeOrthogonalWireToGate(
  from: Point,
  pinOuterX: number,
  pinOuterY: number,
  railColumns: Map<string, number>,
  sourceVar?: string,
  meta?: Pick<WireLayout, 'fromVar' | 'fromGateId' | 'toGateId' | 'toInput'>,
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

  return { id: nextWireId(), segments, ...meta };
}

/**
 * Recursively place gates left-to-right; deeper subtrees sit in earlier columns.
 */
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
      return { point: { x, y }, gates: [], wires: [], drawSteps: [], varTaps: [{ name: ast.name, x, y }], depth: 0 };
    }
    case 'not': {
      const child = layoutNode(ast.child, railColumns, gateZoneStartX, yCursor);
      const depth = child.depth + 1;
      const bodyX = gateColumnX(gateZoneStartX, depth);
      const gateY = child.point.y;
      const gateId = nextGateId();
      const pins = buildGatePins('NOT', bodyX, 0, gateY);

      const inputWire = makeOrthogonalWireToGate(
        child.point,
        pins.inputOuter[0].x,
        pins.inputOuter[0].y,
        railColumns,
        ast.child.type === 'var' ? ast.child.name : undefined,
        {
          toGateId: gateId,
          toInput: 0,
          fromVar: ast.child.type === 'var' ? ast.child.name : undefined,
          fromGateId:
            ast.child.type !== 'var' && child.gates.length > 0
              ? child.gates[child.gates.length - 1].id
              : undefined,
        },
      );
      const wires = [...child.wires, inputWire];

      const gate: GateLayout = {
        id: gateId,
        type: 'NOT',
        x: pins.body.x,
        y: pins.body.y,
        inputYs: pins.inputOuter.map((p) => p.y),
        outputX: pins.outputOuter.x,
        outputY: pins.outputOuter.y,
        expression: formatExpression(ast),
        sourceSpan: ast.span,
      };

      return {
        point: pins.outputOuter,
        gates: [...child.gates, gate],
        wires,
        drawSteps: [
          ...child.drawSteps,
          { type: 'wire', id: inputWire.id },
          { type: 'gate', id: gate.id },
        ],
        varTaps: child.varTaps,
        depth,
      };
    }
    case 'and':
    case 'xor':
    case 'or': {
      const left = layoutNode(ast.left, railColumns, gateZoneStartX, yCursor);
      const right = layoutNode(ast.right, railColumns, gateZoneStartX, yCursor);

      const depth = Math.max(left.depth, right.depth) + 1;
      const bodyX = gateColumnX(gateZoneStartX, depth);
      const gateY = (left.point.y + right.point.y) / 2;
      const gateTop = gateY - LAYOUT.gateHeight / 2;
      const gateType: GateType =
        ast.type === 'and' ? 'AND' : ast.type === 'xor' ? 'XOR' : 'OR';
      const pins = buildGatePins(gateType, bodyX, gateTop);

      const wires = [...left.wires, ...right.wires];

      const leftVar = ast.left.type === 'var' ? ast.left.name : undefined;
      const rightVar = ast.right.type === 'var' ? ast.right.name : undefined;

      const upperFrom = left.point.y <= right.point.y ? left.point : right.point;
      const lowerFrom = left.point.y <= right.point.y ? right.point : left.point;
      const upperVar = left.point.y <= right.point.y ? leftVar : rightVar;
      const lowerVar = left.point.y <= right.point.y ? rightVar : leftVar;

      /**
       * Upper input wire is drawn before the right subtree so pen order matches evaluation.
       */
      const upperFromLeft = left.point.y <= right.point.y;
      const upperSourceGateId = upperFromLeft
        ? left.gates.length > 0
          ? left.gates[left.gates.length - 1].id
          : undefined
        : right.gates.length > 0
          ? right.gates[right.gates.length - 1].id
          : undefined;
      const lowerSourceGateId = upperFromLeft
        ? right.gates.length > 0
          ? right.gates[right.gates.length - 1].id
          : undefined
        : left.gates.length > 0
          ? left.gates[left.gates.length - 1].id
          : undefined;

      const gateId = nextGateId();
      const upperWire = makeOrthogonalWireToGate(
        upperFrom,
        pins.inputOuter[0].x,
        pins.inputOuter[0].y,
        railColumns,
        upperVar,
        {
          toGateId: gateId,
          toInput: 0,
          fromVar: upperVar,
          fromGateId: upperVar ? undefined : upperSourceGateId,
        },
      );
      const lowerWire = makeOrthogonalWireToGate(
        lowerFrom,
        pins.inputOuter[1].x,
        pins.inputOuter[1].y,
        railColumns,
        lowerVar,
        {
          toGateId: gateId,
          toInput: 1,
          fromVar: lowerVar,
          fromGateId: lowerVar ? undefined : lowerSourceGateId,
        },
      );
      wires.push(upperWire, lowerWire);

      const gate: GateLayout = {
        id: gateId,
        type: gateType,
        x: pins.body.x,
        y: pins.body.y,
        inputYs: pins.inputOuter.map((p) => p.y),
        outputX: pins.outputOuter.x,
        outputY: pins.outputOuter.y,
        expression: formatExpression(ast),
        sourceSpan: ast.span,
      };

      return {
        point: pins.outputOuter,
        gates: [...left.gates, ...right.gates, gate],
        wires,
        drawSteps: [
          ...left.drawSteps,
          { type: 'wire', id: upperWire.id },
          ...right.drawSteps,
          { type: 'wire', id: lowerWire.id },
          { type: 'gate', id: gate.id },
        ],
        varTaps: [...left.varTaps, ...right.varTaps],
        depth,
      };
    }
  }
}

/**
 * Build the full circuit graph for a parsed expression.
 */
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

  const outputWire: WireLayout = {
    id: nextWireId(),
    segments: [
      {
        points: [result.point, output],
        jumpers: [],
      },
    ],
    fromGateId:
      result.gates.length > 0 ? result.gates[result.gates.length - 1].id : undefined,
    isOutput: true,
  };
  wires.push(outputWire);

  const drawSteps: DrawStep[] = [
    ...result.drawSteps,
    { type: 'wire', id: outputWire.id },
  ];

  const switches = variables.map((name, i) => ({
    name,
    x: railX(i),
    y: LAYOUT.railTop + LAYOUT.labelOffsetY + LAYOUT.switchBelowLabel,
  }));

  const width = outputX + 80;
  const height = yBottom + 60;

  return {
    variables,
    rails,
    gates,
    wires,
    labels,
    drawSteps,
    varTaps: result.varTaps,
    switches,
    output,
    width,
    height,
  };
}
