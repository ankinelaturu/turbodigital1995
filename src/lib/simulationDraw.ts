/**
 * Simulation-mode full-canvas paint from `CircuitLayout` + `SimulationState`.
 *
 * Replaces the pen stroke queue after the initial draw completes. Supports
 * partial segment rendering during switch-toggle flow animation.
 */
import type { CircuitLayout, Point } from './types';
import { COLORS, LAYOUT, OUTPUT_NAME } from './types';
import { drawCompletedStroke, drawCRTOverlay, drawGateHaloStroke } from './canvasDraw';
import { gateStrokes, partialPolyline } from './drawQueue';
import { segmentKey, type SimulationState } from './simulate';

export interface FlowEntry {
  progress: number;
  direction: 'on' | 'off';
}

type SegmentVisual = 'on' | 'off' | { flow: number; direction: 'on' | 'off' };

/** Merge steady-state segment activity with in-flight flow animation progress. */
function resolveSegmentVisual(
  key: string,
  sim: SimulationState,
  flowAnim: Map<string, FlowEntry>,
): SegmentVisual {
  const flow = flowAnim.get(key);
  if (flow && flow.progress < 1) {
    return { flow: flow.progress, direction: flow.direction };
  }
  return sim.activeSegments.has(key) ? 'on' : 'off';
}

function applyWireStyle(ctx: CanvasRenderingContext2D, on: boolean): void {
  ctx.strokeStyle = on ? COLORS.phosphorOn : COLORS.phosphorDim;
  ctx.fillStyle = on ? COLORS.phosphorOn : COLORS.phosphorDim;
  ctx.shadowColor = on ? COLORS.phosphorOnGlow : COLORS.phosphorOffGlow;
  ctx.shadowBlur = on ? 6 : 2;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

function drawSimpleLine(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  visual: SegmentVisual,
): void {
  if (typeof visual === 'object') {
    const { flow, direction } = visual;
    if (direction === 'on') {
      applyWireStyle(ctx, false);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      applyWireStyle(ctx, true);
      const pts = partialPolyline([a, b], flow);
      if (pts.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.stroke();
      }
    } else {
      applyWireStyle(ctx, true);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      applyWireStyle(ctx, false);
      const pts = partialPolyline([a, b], flow);
      if (pts.length >= 2) {
        const dimStart = pts[pts.length - 1];
        ctx.beginPath();
        ctx.moveTo(dimStart.x, dimStart.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    return;
  }

  applyWireStyle(ctx, visual === 'on');
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function drawJumperArc(
  ctx: CanvasRenderingContext2D,
  railX: number,
  y: number,
  visual: SegmentVisual,
): void {
  const r = LAYOUT.jumperRadius;
  const on = typeof visual === 'object' ? visual.direction === 'on' && visual.flow > 0.3 : visual === 'on';
  applyWireStyle(ctx, on);
  ctx.beginPath();
  ctx.arc(railX, y, r, Math.PI, Math.PI * 2, false);
  ctx.stroke();
}

function drawHorizontalWithJumpers(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  jumpers: { railX: number; y: number }[],
  visual: SegmentVisual,
  railXs: Set<number>,
  dotted: Set<string>,
): void {
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
    drawSimpleLine(ctx, { x: x1, y }, { x: x2, y }, visual);
    for (const pt of [
      { x: x1, y },
      { x: x2, y },
    ]) {
      if (!railXs.has(pt.x)) continue;
      const key = `${pt.x},${pt.y}`;
      if (dotted.has(key)) continue;
      dotted.add(key);
      const dotOn = typeof visual === 'object' ? visual.direction === 'on' : visual === 'on';
      applyWireStyle(ctx, dotOn);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, LAYOUT.railDotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  for (const j of sorted) {
    if (goingRight) {
      addSegment(cursorX, j.railX - r);
      drawJumperArc(ctx, j.railX, y, visual);
      cursorX = j.railX + r;
    } else {
      addSegment(cursorX, j.railX + r);
      drawJumperArc(ctx, j.railX, y, visual);
      cursorX = j.railX - r;
    }
  }

  addSegment(cursorX, endX);
}

function drawWireSegment(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  jumpers: { railX: number; y: number }[],
  visual: SegmentVisual,
  railXs: Set<number>,
  dotted: Set<string>,
): void {
  if (Math.abs(a.y - b.y) < 0.5) {
    drawHorizontalWithJumpers(ctx, a, b, jumpers, visual, railXs, dotted);
  } else {
    drawSimpleLine(ctx, a, b, visual);
  }
}

function drawRails(ctx: CanvasRenderingContext2D, layout: CircuitLayout, sim: SimulationState): void {
  for (const rail of layout.rails) {
    const on = sim.activeRails.has(rail.name);
    applyWireStyle(ctx, on);
    ctx.beginPath();
    ctx.moveTo(rail.x, rail.yTop);
    ctx.lineTo(rail.x, rail.yBottom);
    ctx.stroke();
  }
}

function drawSwitchConnectors(
  ctx: CanvasRenderingContext2D,
  layout: CircuitLayout,
  sim: SimulationState,
): void {
  for (const sw of layout.switches) {
    const on = sim.activeRails.has(sw.name);
    applyWireStyle(ctx, on);
    const y1 = sw.y + 10;
    const y2 = LAYOUT.railTop;
    ctx.beginPath();
    ctx.moveTo(sw.x, y1);
    ctx.lineTo(sw.x, y2);
    ctx.stroke();
  }
}

function drawWires(
  ctx: CanvasRenderingContext2D,
  layout: CircuitLayout,
  sim: SimulationState,
  flowAnim: Map<string, FlowEntry>,
): void {
  const railXs = new Set(layout.rails.map((r) => r.x));
  const dotted = new Set<string>();

  for (const wire of layout.wires) {
    wire.segments.forEach((seg, si) => {
      const key = segmentKey(wire.id, si);
      const visual = resolveSegmentVisual(key, sim, flowAnim);
      const [a, b] = seg.points;
      drawWireSegment(ctx, a, b, seg.jumpers, visual, railXs, dotted);
    });
  }
}

function drawGates(ctx: CanvasRenderingContext2D, layout: CircuitLayout): void {
  for (const gate of layout.gates) {
    for (const stroke of gateStrokes(gate)) {
      drawCompletedStroke(ctx, stroke, false);
    }
  }
}

function drawActiveGateHalos(
  ctx: CanvasRenderingContext2D,
  layout: CircuitLayout,
  sim: SimulationState,
): void {
  for (const gate of layout.gates) {
    if (!sim.activeGates.has(gate.id)) continue;
    for (const stroke of gateStrokes(gate)) {
      drawGateHaloStroke(ctx, stroke);
    }
  }
}

function drawInputLabels(ctx: CanvasRenderingContext2D, layout: CircuitLayout): void {
  ctx.font = '600 18px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.label;
  ctx.shadowColor = COLORS.phosphorGlow;
  ctx.shadowBlur = 8;
  for (const label of layout.labels) {
    ctx.fillText(label.text, label.x, label.y);
  }
}

function drawOutput(
  ctx: CanvasRenderingContext2D,
  layout: CircuitLayout,
  outputOn: boolean,
): void {
  const { x, y } = layout.output;
  const r = LAYOUT.outputCircleR;

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = outputOn ? COLORS.outputOn : COLORS.outputOff;
  ctx.shadowColor = outputOn ? COLORS.outputOnGlow : COLORS.outputOffGlow;
  ctx.shadowBlur = outputOn ? 14 : 4;
  ctx.fill();

  ctx.font = `700 ${LAYOUT.outputLabelSize}px "IBM Plex Mono", monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = outputOn ? COLORS.phosphorOn : COLORS.phosphorDim;
  ctx.shadowBlur = outputOn ? 10 : 3;
  ctx.fillText(OUTPUT_NAME, x + r + 10, y);
}

/**
 * Full simulation frame. Gate halos are drawn last so they sit above the CRT overlay.
 */
export function paintSimulation(
  ctx: CanvasRenderingContext2D,
  layout: CircuitLayout,
  sim: SimulationState,
  flowAnim: Map<string, FlowEntry>,
): void {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, layout.width, layout.height);

  drawInputLabels(ctx, layout);
  drawRails(ctx, layout, sim);
  drawSwitchConnectors(ctx, layout, sim);
  drawWires(ctx, layout, sim, flowAnim);
  drawGates(ctx, layout);
  drawOutput(ctx, layout, sim.output);
  drawCRTOverlay(ctx, layout.width, layout.height);
  drawActiveGateHalos(ctx, layout, sim);
}
