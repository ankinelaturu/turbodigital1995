export interface Point {
  x: number;
  y: number;
}

export const COLORS = {
  bg: '#050805',
  phosphor: '#39ff14',
  phosphorDim: '#1a8f0a',
  phosphorGlow: 'rgba(57, 255, 20, 0.35)',
  label: '#5dff4a',
  /** Gate body + pins (debug contrast vs green wires) */
  gate: '#ff4444',
  gateGlow: 'rgba(255, 68, 68, 0.4)',
};

/** Temporary inspection toggles — flip gatesOnly off to restore full circuit */
export const DEBUG = {
  gatesOnly: false,
};

/** Circuit output terminal and truth-table column (not an input rail). */
export const OUTPUT_NAME = 'Z';

/** Values > 1 make pen strokes finish faster (2 = twice as fast). */
export const DRAW_SPEED = 2;

export const LAYOUT = {
  marginX: 60,
  marginY: 70,
  railSpacing: 64,
  layerSpacing: 110,
  gateWidth: 52,
  gateHeight: 44,
  notWidth: 28,
  notHeight: 28,
  rowStep: 56,
  wireStub: 18,
  /** Gap before gate input where wire turns vertical then enters horizontally */
  gateWireStub: 20,
  /** Horizontal gap between the rightmost rail and the first gate column */
  railToGateGap: 50,
  jumperRadius: 5,
  labelOffsetY: -28,
  railTop: 50,
};

export interface SourceSpan {
  start: number;
  end: number;
}

export type GateType = 'NOT' | 'AND' | 'OR';

export interface GateLayout {
  id: string;
  type: GateType;
  x: number;
  y: number;
  inputYs: number[];
  outputX: number;
  outputY: number;
  /** Boolean sub-expression this gate implements */
  expression: string;
  /** Character range in the original input expression */
  sourceSpan: SourceSpan;
}

export interface RailLayout {
  name: string;
  x: number;
  yTop: number;
  yBottom: number;
}

export interface WireSegmentLayout {
  points: [Point, Point];
  jumpers: { x: number; y: number; railX: number }[];
}

export interface WireLayout {
  id: string;
  segments: WireSegmentLayout[];
}

export interface LabelLayout {
  text: string;
  x: number;
  y: number;
}

/** Pen order after rails: wires and gates interleaved in evaluation order. */
export type DrawStep =
  | { type: 'wire'; id: string }
  | { type: 'gate'; id: string };

export interface CircuitLayout {
  variables: string[];
  rails: RailLayout[];
  gates: GateLayout[];
  wires: WireLayout[];
  labels: LabelLayout[];
  /** Evaluation-order sequence of wires and gates to animate */
  drawSteps: DrawStep[];
  output: Point;
  width: number;
  height: number;
}
