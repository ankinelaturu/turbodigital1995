import type { CircuitLayout, Point } from './types';
import { LAYOUT } from './types';

export type StrokeKind = 'line' | 'arc' | 'polyline' | 'text';

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
  };
  text?: string;
  durationMs: number;
}

let strokeId = 0;

function sid(): string {
  return `s${strokeId++}`;
}

function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function pathLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += dist(points[i - 1], points[i]);
  }
  return total;
}

export function arcLength(r: number, start: number, end: number): number {
  return r * Math.abs(end - start);
}

function gateStrokes(
  type: 'NOT' | 'AND' | 'OR',
  x: number,
  y: number,
  w: number,
  h: number,
): Stroke[] {
  const strokes: Stroke[] = [];
  const dur = 280;

  switch (type) {
    case 'NOT': {
      const triW = w - 8;
      strokes.push({
        id: sid(),
        kind: 'polyline',
        phase: 'gate',
        points: [
          { x, y },
          { x: x + triW, y: y + h / 2 },
          { x, y: y + h },
          { x, y },
        ],
        durationMs: dur,
      });
      const bx = x + triW + 4;
      const by = y + h / 2;
      strokes.push({
        id: sid(),
        kind: 'arc',
        phase: 'gate',
        points: [],
        arc: { cx: bx, cy: by, r: 5, start: 0, end: Math.PI * 2 },
        durationMs: 200,
      });
      break;
    }
    case 'AND': {
      const left = x;
      const top = y;
      const bottom = y + h;
      const right = x + w;
      const midY = y + h / 2;
      const arcR = h / 2;
      strokes.push({
        id: sid(),
        kind: 'line',
        phase: 'gate',
        points: [
          { x: left, y: top },
          { x: left, y: bottom },
        ],
        durationMs: dur * 0.4,
      });
      strokes.push({
        id: sid(),
        kind: 'arc',
        phase: 'gate',
        points: [],
        arc: {
          cx: left,
          cy: midY,
          r: arcR,
          start: -Math.PI / 2,
          end: Math.PI / 2,
        },
        durationMs: dur * 0.6,
      });
      strokes.push({
        id: sid(),
        kind: 'line',
        phase: 'gate',
        points: [
          { x: left, y: top },
          { x: right, y: top },
        ],
        durationMs: dur * 0.2,
      });
      strokes.push({
        id: sid(),
        kind: 'line',
        phase: 'gate',
        points: [
          { x: left, y: bottom },
          { x: right, y: bottom },
        ],
        durationMs: dur * 0.2,
      });
      break;
    }
    case 'OR': {
      const left = x;
      const top = y;
      const bottom = y + h;
      const right = x + w;
      const midY = y + h / 2;
      strokes.push({
        id: sid(),
        kind: 'polyline',
        phase: 'gate',
        points: [
          { x: left + 8, y: top },
          { x: right, y: midY },
          { x: left + 8, y: bottom },
        ],
        durationMs: dur,
      });
      strokes.push({
        id: sid(),
        kind: 'arc',
        phase: 'gate',
        points: [],
        arc: {
          cx: left + 14,
          cy: midY,
          r: h / 2 - 2,
          start: Math.PI / 2,
          end: -Math.PI / 2,
        },
        durationMs: dur * 0.7,
      });
      break;
    }
  }
  return strokes;
}

function wireStrokesWithJumpers(
  a: Point,
  b: Point,
  jumpers: { railX: number; y: number }[],
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
      durationMs: 200 + Math.abs(x2 - x1) * 1.2,
    });
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
        end: 0,
      },
      durationMs: 220,
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

export function buildDrawQueue(layout: CircuitLayout): Stroke[] {
  strokeId = 0;
  const strokes: Stroke[] = [];

  for (const label of layout.labels) {
    strokes.push({
      id: sid(),
      kind: 'text',
      phase: 'label',
      points: [{ x: label.x, y: label.y }],
      text: label.text,
      durationMs: 400,
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
      durationMs: 500 + (rail.yBottom - rail.yTop) * 0.8,
    });
  }

  for (const wire of layout.wires) {
    const [a, b] = wire.points;
    strokes.push(...wireStrokesWithJumpers(a, b, wire.jumpers));
  }

  for (const gate of layout.gates) {
    const w = gate.type === 'NOT' ? LAYOUT.notWidth : LAYOUT.gateWidth;
    const h = gate.type === 'NOT' ? LAYOUT.notHeight : LAYOUT.gateHeight;
    strokes.push(...gateStrokes(gate.type, gate.x, gate.y, w, h));
  }

  strokes.push({
    id: sid(),
    kind: 'text',
    phase: 'output',
    points: [{ x: layout.output.x + 8, y: layout.output.y + 5 }],
    text: 'F',
    durationMs: 350,
  });

  return strokes;
}

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
