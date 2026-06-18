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
import { COLORS } from '../lib/types';

type GateDrawMode = 'flat' | 'glow' | 'halo';

/** Draw a stroke path at progress `t` (0–1) for pen animation partial segments. */
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
      ctx.font = '600 18px "IBM Plex Mono", monospace';
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
      { width: 14, color: COLORS.gateActiveHaloOuter },
      { width: 9, color: COLORS.gateActiveHalo },
      { width: 5, color: 'rgba(255, 100, 100, 0.7)' },
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

export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  progress: number,
  gateGlow = false,
): void {
  const isGate = stroke.phase === 'gate';
  const t = Math.min(1, Math.max(0, progress));

  if (isGate) {
    drawGateStroke(ctx, stroke, t, gateGlow ? 'glow' : 'flat');
    return;
  }

  ctx.strokeStyle = COLORS.phosphor;
  ctx.fillStyle = COLORS.phosphor;
  ctx.shadowColor = COLORS.phosphorGlow;
  ctx.shadowBlur = 4;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  renderStrokePath(ctx, stroke, t);
}

export function drawCompletedStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  gateGlow = false,
): void {
  drawStroke(ctx, stroke, 1, gateGlow);
}

/** Halo-only pass for active gates — draw after CRT overlay so glow stays visible. */
export function drawGateHaloStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
): void {
  if (stroke.phase !== 'gate') return;
  drawGateStroke(ctx, stroke, 1, 'halo');
}

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

/** Vignette + scanlines applied after the circuit is drawn. */
export function drawCRTOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.7);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(0, 20, 0, 0.08)';
  for (let y = 0; y < h; y += 3) {
    ctx.fillRect(0, y, w, 1);
  }
}
