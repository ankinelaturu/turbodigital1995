/**
 * Build the ordered list of pen strokes for the initial draw animation.
 *
 * Order: labels → rails → `drawSteps` (wires + gates interleaved) → Z label.
 * Horizontal wires crossing rails emit jumper arcs and junction dots.
 */
import type { CircuitLayout, GateLayout, Point, WireLayout } from './types';
import { DEBUG, DRAW_SPEED, LAYOUT, OUTPUT_NAME } from './types';
import { orGateBezierCurves, xorGateBezierCurves } from './bezier';
import { buildGatePins, inputPinStrokes } from './gateGeometry';

/**
 * Primitive geometry kinds used in the pen stroke queue.
 */
export type StrokeKind = 'line' | 'arc' | 'polyline' | 'text' | 'dot';

/**
 * One timed pen stroke in the draw animation queue.
 */
export interface Stroke {
  id: string;
  kind: StrokeKind;
  phase: 'label' | 'rail' | 'wire' | 'jumper' | 'gate' | 'output';
  points: Point[];
  arc?: {
    cx: number;
    cy: number;
    r: number;
    start: number;
    end: number;
    /**
     * When set, overrides default canvas arc winding (jumpers use CCW for upward hump).
     */
    ccw?: boolean;
  };
  text?: string;
  dotR?: number;
  durationMs: number;
}

let strokeId = 0;

function sid(): string {
  return `s${strokeId++}`;
}

/**
 * Scale base durations by `DRAW_SPEED`; floor keeps very short strokes visible.
 */
function animMs(ms: number): number {
  return Math.max(35, Math.round(ms / DRAW_SPEED));
}

function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Total polyline length in layout pixels.
 */
export function pathLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += dist(points[i - 1], points[i]);
  }
  return total;
}

/**
 * Arc length between two angles on a circle of radius `r`.
 */
export function arcLength(r: number, start: number, end: number): number {
  return r * Math.abs(end - start);
}

function addLineStroke(
  strokes: Stroke[],
  a: Point,
  b: Point,
  dur: number,
): void {
  strokes.push({
    id: sid(),
    kind: 'line',
    phase: 'gate',
    points: [a, b],
    durationMs: animMs(dur),
  });
}

/**
 * Canvas strokes for one gate symbol — shared by pen draw and simulation paint.
 */
export function gateStrokes(gate: GateLayout): Stroke[] {
  const strokes: Stroke[] = [];
  const gateDur = 280;
  const centerY = gate.type === 'NOT' ? gate.outputY : undefined;
  const pins = buildGatePins(gate.type, gate.x, gate.y, centerY);
  const { body } = pins;

  for (const { outer, inner } of inputPinStrokes(pins)) {
    addLineStroke(strokes, outer, inner, gateDur * 0.25);
  }

  switch (gate.type) {
    case 'NOT': {
      const w = body.w;
      const h = body.h;
      const triW = w - 8;
      strokes.push({
        id: sid(),
        kind: 'polyline',
        phase: 'gate',
        points: [
          { x: body.x, y: body.y },
          { x: body.x + triW, y: body.y + h / 2 },
          { x: body.x, y: body.y + h },
          { x: body.x, y: body.y },
        ],
        durationMs: animMs(gateDur),
      });
      const bx = body.x + triW + 4;
      const by = body.y + h / 2;
      strokes.push({
        id: sid(),
        kind: 'arc',
        phase: 'gate',
        points: [],
        arc: { cx: bx, cy: by, r: 5, start: 0, end: Math.PI * 2 },
        durationMs: animMs(200),
      });
      addLineStroke(strokes, pins.outputInner, pins.outputOuter, gateDur * 0.25);
      break;
    }
    case 'AND': {
      const left = body.x;
      const top = body.y;
      const bottom = body.y + body.h;
      const midY = body.y + body.h / 2;
      const arcR = body.h / 2;
      const arcCx = left + arcR;
      strokes.push({
        id: sid(),
        kind: 'line',
        phase: 'gate',
        points: [
          { x: left, y: top },
          { x: left, y: bottom },
        ],
        durationMs: animMs(gateDur * 0.4),
      });
      strokes.push({
        id: sid(),
        kind: 'line',
        phase: 'gate',
        points: [
          { x: left, y: top },
          { x: arcCx, y: top },
        ],
        durationMs: animMs(gateDur * 0.2),
      });
      strokes.push({
        id: sid(),
        kind: 'line',
        phase: 'gate',
        points: [
          { x: left, y: bottom },
          { x: arcCx, y: bottom },
        ],
        durationMs: animMs(gateDur * 0.2),
      });
      strokes.push({
        id: sid(),
        kind: 'arc',
        phase: 'gate',
        points: [],
        arc: {
          cx: arcCx,
          cy: midY,
          r: arcR,
          start: -Math.PI / 2,
          end: Math.PI / 2,
        },
        durationMs: animMs(gateDur * 0.6),
      });
      addLineStroke(strokes, pins.outputInner, pins.outputOuter, gateDur * 0.25);
      break;
    }
    case 'OR': {
      const curves = orGateBezierCurves(body.x, body.y, body.w, body.h);
      const curveDur = animMs(gateDur * 0.85);
      strokes.push({
        id: sid(),
        kind: 'polyline',
        phase: 'gate',
        points: curves.back,
        durationMs: curveDur,
      });
      strokes.push({
        id: sid(),
        kind: 'polyline',
        phase: 'gate',
        points: curves.top,
        durationMs: curveDur,
      });
      strokes.push({
        id: sid(),
        kind: 'polyline',
        phase: 'gate',
        points: curves.bottom,
        durationMs: curveDur,
      });
      addLineStroke(strokes, pins.outputInner, pins.outputOuter, gateDur * 0.25);
      break;
    }
    case 'XOR': {
      const curves = xorGateBezierCurves(
        body.x,
        body.y,
        body.w,
        body.h,
        LAYOUT.xorBackGap,
      );
      const curveDur = animMs(gateDur * 0.85);
      strokes.push({
        id: sid(),
        kind: 'polyline',
        phase: 'gate',
        points: curves.backOuter,
        durationMs: curveDur,
      });
      strokes.push({
        id: sid(),
        kind: 'polyline',
        phase: 'gate',
        points: curves.backInner,
        durationMs: curveDur,
      });
      strokes.push({
        id: sid(),
        kind: 'polyline',
        phase: 'gate',
        points: curves.top,
        durationMs: curveDur,
      });
      strokes.push({
        id: sid(),
        kind: 'polyline',
        phase: 'gate',
        points: curves.bottom,
        durationMs: curveDur,
      });
      addLineStroke(strokes, pins.outputInner, pins.outputOuter, gateDur * 0.25);
      break;
    }
  }
  return strokes;
}

function addRailJunctionDot(
  strokes: Stroke[],
  pt: Point,
  railXs: Set<number>,
  dotted: Set<string>,
): void {
  if (!railXs.has(pt.x)) return;
  const key = `${pt.x},${pt.y}`;
  if (dotted.has(key)) return;
  dotted.add(key);
  strokes.push({
    id: sid(),
    kind: 'dot',
    phase: 'wire',
    points: [pt],
    dotR: LAYOUT.railDotRadius,
    durationMs: animMs(100),
  });
}

function wireSegmentStrokes(
  a: Point,
  b: Point,
  jumpers: { railX: number; y: number }[],
  railXs: Set<number>,
  dotted: Set<string>,
): Stroke[] {
  if (Math.abs(a.y - b.y) < 0.5) {
    return wireStrokesWithJumpers(a, b, jumpers, railXs, dotted);
  }
  const len = Math.abs(b.y - a.y);
  return [
    {
      id: sid(),
      kind: 'line',
      phase: 'wire',
      points: [a, b],
      durationMs: animMs(200 + len * 1.2),
    },
  ];
}

/**
 * Split a horizontal wire at rail crossings into segments + upward jumper arcs (∩).
 */
function wireStrokesWithJumpers(
  a: Point,
  b: Point,
  jumpers: { railX: number; y: number }[],
  railXs: Set<number>,
  dotted: Set<string>,
): Stroke[] {
  const strokes: Stroke[] = [];
  const y = a.y;
  const r = LAYOUT.jumperRadius;
  const goingRight = a.x < b.x;
  const startX = a.x;
  const endX = b.x;
  const minX = Math.min(startX, endX);
  const maxX = Math.max(startX, endX);

  const sorted = [...jumpers]
    .filter((j) => j.railX > minX + r && j.railX < maxX - r)
    .sort((j1, j2) => (goingRight ? j1.railX - j2.railX : j2.railX - j1.railX));

  let cursorX = startX;

  const addSegment = (x1: number, x2: number) => {
    if (Math.abs(x2 - x1) < 0.5) return;
    strokes.push({
      id: sid(),
      kind: 'line',
      phase: 'wire',
      points: [
        { x: x1, y },
        { x: x2, y },
      ],
      durationMs: animMs(200 + Math.abs(x2 - x1) * 1.2),
    });
    addRailJunctionDot(strokes, { x: x1, y }, railXs, dotted);
    addRailJunctionDot(strokes, { x: x2, y }, railXs, dotted);
  };

  const addJumper = (railX: number) => {
    strokes.push({
      id: sid(),
      kind: 'arc',
      phase: 'jumper',
      points: [],
      arc: {
        cx: railX,
        cy: y,
        r,
        start: Math.PI,
        end: Math.PI * 2,
        ccw: false,
      },
      durationMs: animMs(220),
    });
  };

  for (const j of sorted) {
    if (goingRight) {
      addSegment(cursorX, j.railX - r);
      addJumper(j.railX);
      cursorX = j.railX + r;
    } else {
      addSegment(cursorX, j.railX + r);
      addJumper(j.railX);
      cursorX = j.railX - r;
    }
  }

  addSegment(cursorX, endX);
  return strokes;
}

function strokesForWire(
  wire: WireLayout,
  railXs: Set<number>,
  dotted: Set<string>,
): Stroke[] {
  const strokes: Stroke[] = [];
  for (const seg of wire.segments) {
    const [a, b] = seg.points;
    strokes.push(...wireSegmentStrokes(a, b, seg.jumpers, railXs, dotted));
  }
  return strokes;
}

/**
 * Turn a laid-out circuit into the timed stroke queue for pen animation.
 */
export function buildDrawQueue(layout: CircuitLayout): Stroke[] {
  strokeId = 0;
  const strokes: Stroke[] = [];

  if (DEBUG.gatesOnly) {
    for (const gate of layout.gates) {
      strokes.push(...gateStrokes(gate));
    }
    return strokes;
  }

  for (const label of layout.labels) {
    strokes.push({
      id: sid(),
      kind: 'text',
      phase: 'label',
      points: [{ x: label.x, y: label.y }],
      text: label.text,
      durationMs: animMs(400),
    });
  }

  for (const rail of layout.rails) {
    strokes.push({
      id: sid(),
      kind: 'line',
      phase: 'rail',
      points: [
        { x: rail.x, y: rail.yTop },
        { x: rail.x, y: rail.yBottom },
      ],
      durationMs: animMs(500 + (rail.yBottom - rail.yTop) * 0.8),
    });
  }

  const gateById = new Map(layout.gates.map((g) => [g.id, g]));
  const wireById = new Map(layout.wires.map((w) => [w.id, w]));
  const railXs = new Set(layout.rails.map((r) => r.x));
  const railDots = new Set<string>();

  for (const step of layout.drawSteps) {
    if (step.type === 'wire') {
      const wire = wireById.get(step.id);
      if (wire) strokes.push(...strokesForWire(wire, railXs, railDots));
    } else {
      const gate = gateById.get(step.id);
      if (gate) strokes.push(...gateStrokes(gate));
    }
  }

  strokes.push({
    id: sid(),
    kind: 'text',
    phase: 'output',
    points: [{ x: layout.output.x, y: layout.output.y }],
    text: OUTPUT_NAME,
    durationMs: animMs(350),
  });

  return strokes;
}

/**
 * Point along an arc at parameter `t` ∈ [0, 1].
 */
export function pointOnArc(
  cx: number,
  cy: number,
  r: number,
  start: number,
  end: number,
  t: number,
): Point {
  const angle = start + (end - start) * t;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

/**
 * Clip a polyline to `progress` along its total path length (pen animation).
 */
export function partialPolyline(points: Point[], progress: number): Point[] {
  if (points.length < 2) return points;
  const total = pathLength(points);
  const target = total * Math.min(1, Math.max(0, progress));
  const result: Point[] = [points[0]];
  let traveled = 0;
  for (let i = 1; i < points.length; i++) {
    const seg = dist(points[i - 1], points[i]);
    if (traveled + seg >= target) {
      const t = (target - traveled) / seg;
      result.push({
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * t,
      });
      return result;
    }
    result.push(points[i]);
    traveled += seg;
  }
  return result;
}
