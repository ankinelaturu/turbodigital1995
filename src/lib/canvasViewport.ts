/**
 * Viewport scaling: letterbox circuit layout coordinates into the canvas element.
 *
 * `computeViewport` fits the layout bounding box inside the container; `paintWithViewport`
 * clears the canvas, draws in layout space, then applies the CRT overlay.
 */
import { drawCRTOverlay } from './canvasDraw';
import { COLORS } from './types';

/**
 * Screen-space mapping from layout coordinates to the full-size canvas.
 */
export interface CanvasViewport {
  scale: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

/**
 * Fit `layoutWidth` × `layoutHeight` inside the canvas, preserving aspect ratio.
 */
export function computeViewport(
  width: number,
  height: number,
  layoutWidth: number,
  layoutHeight: number,
): CanvasViewport {
  const scale = Math.min(width / layoutWidth, height / layoutHeight);
  return {
    scale,
    offsetX: (width - layoutWidth * scale) / 2,
    offsetY: (height - layoutHeight * scale) / 2,
    width,
    height,
  };
}

/**
 * Map one layout-space point to canvas pixel coordinates.
 */
export function layoutToScreen(
  vp: CanvasViewport,
  x: number,
  y: number,
): { x: number; y: number } {
  return { x: vp.offsetX + x * vp.scale, y: vp.offsetY + y * vp.scale };
}

/**
 * Clear the full canvas, draw circuit content in layout space, then CRT
 * (and an optional overlay pass above the CRT, e.g. gate halos).
 */
export function paintWithViewport(
  ctx: CanvasRenderingContext2D,
  vp: CanvasViewport,
  drawCircuit: () => void,
  drawAboveOverlay?: () => void,
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, vp.width, vp.height);

  ctx.save();
  ctx.translate(vp.offsetX, vp.offsetY);
  ctx.scale(vp.scale, vp.scale);
  drawCircuit();
  ctx.restore();

  drawCRTOverlay(ctx, vp.width, vp.height);

  if (drawAboveOverlay) {
    ctx.save();
    ctx.translate(vp.offsetX, vp.offsetY);
    ctx.scale(vp.scale, vp.scale);
    drawAboveOverlay();
    ctx.restore();
  }
}
