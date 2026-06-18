import type { Point } from './types';

/** Cubic Bezier: B(t) with control points p0, p1, p2, p3 */
export function cubicBezierPoint(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number,
): Point {
  const u = 1 - t;
  const u2 = u * u;
  const u3 = u2 * u;
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: u3 * p0.x + 3 * u2 * t * p1.x + 3 * u * t2 * p2.x + t3 * p3.x,
    y: u3 * p0.y + 3 * u2 * t * p1.y + 3 * u * t2 * p2.y + t3 * p3.y,
  };
}

/** Sample a cubic Bezier into a LINE_STRIP-style vertex list (inclusive endpoints). */
export function sampleCubicBezier(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  segmentCount = 28,
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= segmentCount; i++) {
    points.push(cubicBezierPoint(p0, p1, p2, p3, i / segmentCount));
  }
  return points;
}

/** OR gate outline as three cubic Beziers (back, top, bottom). */
function orGateBackControls(x: number, y: number, w: number, h: number) {
  const leftX = x;
  const backBulge = Math.max(10, w * 0.27);
  return {
    p0: { x: leftX, y },
    p1: { x: leftX + backBulge, y: y + h * 0.12 },
    p2: { x: leftX + backBulge, y: y + h * 0.88 },
    p3: { x: leftX, y: y + h },
  };
}

/** X on the OR back curve at pin height (input leads meet the bulging left edge). */
export function orGateBackXAtY(
  x: number,
  y: number,
  w: number,
  h: number,
  targetY: number,
): number {
  const { p0, p1, p2, p3 } = orGateBackControls(x, y, w, h);
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    const py = cubicBezierPoint(p0, p1, p2, p3, mid).y;
    if (py < targetY) lo = mid;
    else hi = mid;
  }
  const t = (lo + hi) / 2;
  return cubicBezierPoint(p0, p1, p2, p3, t).x;
}

export function orGateBezierCurves(
  x: number,
  y: number,
  w: number,
  h: number,
): { back: Point[]; top: Point[]; bottom: Point[] } {
  const inset = 0;
  const leftX = x + inset;
  const topLeft: Point = { x: leftX, y };
  const bottomLeft: Point = { x: leftX, y: y + h };
  const tip: Point = { x: x + w, y: y + h / 2 };
  const midY = y + h / 2;
  const { p0, p1, p2, p3 } = orGateBackControls(x, y, w, h);

  const back = sampleCubicBezier(p0, p1, p2, p3, 32);

  // Outer edges: leave left nearly horizontal (P1 collinear with corner), bow outward
  // in the second half (P2), then ease into the fixed output tip (rounded nose).
  const top = sampleCubicBezier(
    topLeft,
    { x: leftX + w * 0.5, y: topLeft.y },
    { x: tip.x - w * 0.05, y: midY - h * 0.32 },
    tip,
    40,
  );

  const bottom = sampleCubicBezier(
    bottomLeft,
    { x: leftX + w * 0.5, y: bottomLeft.y },
    { x: tip.x - w * 0.05, y: midY + h * 0.32 },
    tip,
    40,
  );

  return { back, top, bottom };
}
