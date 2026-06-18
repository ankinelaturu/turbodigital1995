/**
 * Gate pin and body geometry — single source of truth for layout wire endpoints
 * and canvas gate symbols. `buildGatePins` is called from both `layout.ts` and `drawQueue.ts`.
 */
import { LAYOUT, type GateType, type Point } from './types';
import type { GateLayout } from './types';
import { orGateBackXAtY, xorGateBezierCurves } from './bezier';

/** Short lead length drawn as part of the gate symbol; external wires attach here. */
export const GATE_PIN_LENGTH = 10;

export interface GateBodyRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GatePins {
  body: GateBodyRect;
  inputOuter: Point[];
  inputInner: Point[];
  outputInner: Point;
  outputOuter: Point;
}

export function dualInputPinYs(bodyY: number, bodyH: number): [number, number] {
  return [bodyY + bodyH / 3, bodyY + (2 * bodyH) / 3];
}

/**
 * Shared geometry for layout (wire endpoints) and drawing (body + pin strokes).
 * bodyX/bodyY: top-left of gate body (not including input pins).
 */
export function buildGatePins(
  type: GateType,
  bodyX: number,
  bodyY: number,
  centerY?: number,
): GatePins {
  const pin = GATE_PIN_LENGTH;

  switch (type) {
    case 'NOT': {
      const w = LAYOUT.notWidth;
      const h = LAYOUT.notHeight;
      const cy = centerY ?? bodyY + h / 2;
      const top = cy - h / 2;
      const triW = w - 8;
      const bubbleCenterX = bodyX + triW + 4;
      const outputInnerX = bubbleCenterX + 5;
      return {
        body: { x: bodyX, y: top, w, h },
        inputOuter: [{ x: bodyX - pin, y: cy }],
        inputInner: [{ x: bodyX, y: cy }],
        outputInner: { x: outputInnerX, y: cy },
        outputOuter: { x: outputInnerX + pin, y: cy },
      };
    }
    case 'AND': {
      const h = LAYOUT.gateHeight;
      const w = h;
      const [upper, lower] = dualInputPinYs(bodyY, h);
      const bodyRight = bodyX + w;
      const midY = bodyY + h / 2;
      return {
        body: { x: bodyX, y: bodyY, w, h },
        inputOuter: [
          { x: bodyX - pin, y: upper },
          { x: bodyX - pin, y: lower },
        ],
        inputInner: [
          { x: bodyX, y: upper },
          { x: bodyX, y: lower },
        ],
        outputInner: { x: bodyRight, y: midY },
        outputOuter: { x: bodyRight + pin, y: midY },
      };
    }
    case 'OR':
    case 'XOR': {
      const h = LAYOUT.gateHeight;
      const w = LAYOUT.gateWidth;
      const [upper, lower] = dualInputPinYs(bodyY, h);
      const tipX = bodyX + w;
      const midY = bodyY + h / 2;
      return {
        body: { x: bodyX, y: bodyY, w, h },
        inputOuter: [
          { x: bodyX - pin, y: upper },
          { x: bodyX - pin, y: lower },
        ],
        inputInner: [
          { x: orGateBackXAtY(bodyX, bodyY, w, h, upper), y: upper },
          { x: orGateBackXAtY(bodyX, bodyY, w, h, lower), y: lower },
        ],
        outputInner: { x: tipX, y: midY },
        outputOuter: { x: tipX + pin, y: midY },
      };
    }
  }
}

export function inputPinStrokes(pins: GatePins): { outer: Point; inner: Point }[] {
  return pins.inputOuter.map((outer, i) => ({
    outer,
    inner: pins.inputInner[i],
  }));
}

/** Axis-aligned hover target covering body and pin leads. */
export function gateHitBounds(gate: GateLayout): { x: number; y: number; w: number; h: number } {
  const centerY = gate.type === 'NOT' ? gate.outputY : undefined;
  const pins = buildGatePins(gate.type, gate.x, gate.y, centerY);
  const { body } = pins;
  const points: Point[] = [
    ...pins.inputOuter,
    ...pins.inputInner,
    pins.outputInner,
    pins.outputOuter,
    { x: body.x, y: body.y },
    { x: body.x + body.w, y: body.y },
    { x: body.x, y: body.y + body.h },
    { x: body.x + body.w, y: body.y + body.h },
  ];
  if (gate.type === 'XOR') {
    const curves = xorGateBezierCurves(body.x, body.y, body.w, body.h, LAYOUT.xorBackGap);
    points.push(...curves.backOuter);
  }
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const pad = 4;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const maxX = Math.max(...xs) + pad;
  const maxY = Math.max(...ys) + pad;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
