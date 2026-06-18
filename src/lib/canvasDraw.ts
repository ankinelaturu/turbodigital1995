import type { Stroke } from '../lib/drawQueue';
import {
  arcLength,
  partialPolyline,
  pathLength,
} from '../lib/drawQueue';
import { COLORS } from '../lib/types';

export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  progress: number,
): void {
  ctx.strokeStyle = COLORS.phosphor;
  ctx.fillStyle = COLORS.phosphor;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = COLORS.phosphorGlow;
  ctx.shadowBlur = 4;

  const t = Math.min(1, Math.max(0, progress));

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
      ctx.beginPath();
      ctx.arc(a.cx, a.cy, a.r, a.start, endAngle, a.end < a.start);
      ctx.stroke();
      break;
    }
    case 'text': {
      if (t < 1) return;
      const p = stroke.points[0];
      ctx.font = '600 18px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 8;
      ctx.fillText(stroke.text ?? '', p.x, p.y);
      break;
    }
  }
}

export function drawCompletedStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
): void {
  drawStroke(ctx, stroke, 1);
}

export function strokeTotalLength(stroke: Stroke): number {
  switch (stroke.kind) {
    case 'line':
    case 'polyline':
      return pathLength(stroke.points);
    case 'arc':
      return stroke.arc ? arcLength(stroke.arc.r, stroke.arc.start, stroke.arc.end) : 0;
    case 'text':
      return 1;
    default:
      return 1;
  }
}

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
