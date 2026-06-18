import { LAYOUT, type GateType, type Point } from './types';
import { orGateBackXAtY } from './bezier';

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
    case 'OR': {
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
