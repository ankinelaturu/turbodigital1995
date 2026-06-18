/**
 * Low-level canvas stroke rendering for pen animation and simulation.
 *
 * Gates use red (`COLORS.gate`) always; active gates get a multi-pass halo drawn
 * on top of the CRT overlay so the glow is not dimmed away.
 */
import type { Stroke } from '../lib/drawQueue';
import {
  arcLength,
  partialPolyline,
  pathLength,
} from '../lib/drawQueue';
import { COLORS, LAYOUT } from '../lib/types';

type GateDrawMode = 'flat' | 'glow' | 'halo';

/**
 * Draw a stroke path at progress `t` (0–1) for pen animation partial segments.
 */
function renderStrokePath(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  t: number,
): void {
  switch (stroke.kind) {
    case 'line': {
      const pts = partialPolyline(stroke.points, t);
      if (pts.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
      break;
    }
    case 'polyline': {
      const pts = partialPolyline(stroke.points, t);
      if (pts.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
      break;
    }
    case 'arc': {
      const a = stroke.arc;
      if (!a) return;
      const len = arcLength(a.r, a.start, a.end);
      const partial = len * t;
      const angleProgress = partial / len;
      const endAngle = a.start + (a.end - a.start) * angleProgress;
      const ccw = a.ccw ?? a.end < a.start;
      ctx.beginPath();
      ctx.arc(a.cx, a.cy, a.r, a.start, endAngle, ccw);
      ctx.stroke();
      break;
    }
    case 'dot': {
      const p = stroke.points[0];
      const r = (stroke.dotR ?? 2) * t;
      if (r < 0.1) return;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'text': {
      if (t < 1) return;
      const p = stroke.points[0];
      ctx.font =
        stroke.phase === 'output'
          ? `700 ${LAYOUT.outputLabelSize}px "IBM Plex Mono", monospace`
          : '600 18px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(stroke.text ?? '', p.x, p.y);
      break;
    }
  }
}

/**
 * Gate strokes: `flat` = crisp red only; `glow` = halo + core (pen mode);
 * `halo` = wide passes only — composited after CRT in simulation.
 */
function drawGateStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  t: number,
  mode: GateDrawMode,
): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';

  if (mode === 'glow' || mode === 'halo') {
    const halos: { width: number; color: string }[] = [
      { width: 3.5, color: COLORS.gateActiveHaloOuter },
      { width: 2.25, color: COLORS.gateActiveHalo },
      { width: 3, color: 'rgba(255, 100, 100, 0.45)' },
    ];
    for (const halo of halos) {
      ctx.strokeStyle = halo.color;
      ctx.fillStyle = halo.color;
      ctx.lineWidth = halo.width;
      renderStrokePath(ctx, stroke, t);
    }
  }

  if (mode !== 'halo') {
    ctx.strokeStyle = COLORS.gate;
    ctx.fillStyle = COLORS.gate;
    ctx.lineWidth = 1.5;
    renderStrokePath(ctx, stroke, t);
  }
}

/**
 * Draw one stroke at partial or full progress.
 *
 * Gates use red always; `gateGlow` adds a halo during pen draw.
 * `dimWires` renders non-gate strokes in the off/dim phosphor palette.
 */
export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  progress: number,
  gateGlow = false,
  dimWires = false,
): void {
  const isGate = stroke.phase === 'gate';
  const t = Math.min(1, Math.max(0, progress));

  if (isGate) {
    drawGateStroke(ctx, stroke, t, gateGlow ? 'glow' : 'flat');
    return;
  }

  if (dimWires) {
    ctx.strokeStyle = COLORS.phosphorDim;
    ctx.fillStyle = COLORS.phosphorDim;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  } else {
    ctx.strokeStyle = COLORS.phosphor;
    ctx.fillStyle = COLORS.phosphor;
    ctx.shadowColor = COLORS.phosphorGlow;
    ctx.shadowBlur = 4;
  }
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (stroke.kind === 'text') {
    if (stroke.phase === 'label') {
      ctx.fillStyle = COLORS.label;
    } else if (stroke.phase === 'output') {
      ctx.fillStyle = COLORS.outputLabel;
    } else {
      ctx.fillStyle = COLORS.phosphorDim;
    }
    ctx.shadowBlur = 0;
  }

  renderStrokePath(ctx, stroke, t);
}

/**
 * Draw a stroke at full progress (used for completed pen strokes and simulation gates).
 */
export function drawCompletedStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  gateGlow = false,
  dimWires = false,
): void {
  drawStroke(ctx, stroke, 1, gateGlow, dimWires);
}

/**
 * Halo-only pass for active gates — draw after CRT overlay so glow stays visible.
 */
export function drawGateHaloStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
): void {
  if (stroke.phase !== 'gate') return;
  drawGateStroke(ctx, stroke, 1, 'halo');
}

/**
 * Total path length of a stroke (used for pen animation timing).
 */
export function strokeTotalLength(stroke: Stroke): number {
  switch (stroke.kind) {
    case 'line':
    case 'polyline':
      return pathLength(stroke.points);
    case 'arc':
      return stroke.arc ? arcLength(stroke.arc.r, stroke.arc.start, stroke.arc.end) : 0;
    case 'text':
    case 'dot':
      return 1;
    default:
      return 1;
  }
}

/**
 * Vignette + scanlines applied after the circuit is drawn.
 */
export function drawCRTOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.6);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(0, 20, 0, 0.04)';
  for (let y = 0; y < h; y += 4) {
    ctx.fillRect(0, y, w, 1);
  }
}
