/**
 * Shared types, layout constants, and the `CircuitLayout` graph produced by `layout.ts`.
 *
 * Pipeline: parse → buildLayout → buildDrawQueue / computeSimulation → canvas paint.
 */
export interface Point {
  x: number;
  y: number;
}

/** CRT phosphor palette — wires/rails use on/dim pairs; gates stay red with optional halo. */
export const COLORS = {
  bg: '#050805',
  phosphor: '#39ff14',
  phosphorDim: '#1a8f0a',
  phosphorGlow: 'rgba(57, 255, 20, 0.35)',
  label: '#5dff4a',
  /** Inactive wire / rail (no current) */
  phosphorOff: '#0d2a0d',
  phosphorOffGlow: 'rgba(13, 42, 13, 0.2)',
  /** Active wire / rail (current flowing) */
  phosphorOn: '#39ff14',
  phosphorOnGlow: 'rgba(57, 255, 20, 0.55)',
  /** Output Z terminal */
  outputOn: '#39ff14',
  outputOff: '#1a5f1a',
  outputOnGlow: 'rgba(57, 255, 20, 0.7)',
  outputOffGlow: 'rgba(13, 42, 13, 0.15)',
  /** Gate body + pins (debug contrast vs green wires) */
  gate: '#ff4444',
  gateGlow: 'rgba(255, 68, 68, 0.4)',
  /** Subtle halo passes when gate output is HIGH */
  gateActiveHalo: 'rgba(255, 80, 80, 0.38)',
  gateActiveHaloOuter: 'rgba(255, 68, 68, 0.12)',
};

/** Temporary inspection toggles — flip gatesOnly off to restore full circuit */
export const DEBUG = {
  gatesOnly: false,
};

/** Circuit output terminal and truth-table column (not an input rail). */
export const OUTPUT_NAME = 'Z';

/** Values > 1 make pen strokes finish faster (4 = four times as fast). */
export const DRAW_SPEED = 4;

/** Fast current-flow animation when switches change (ms per segment). */
export const SIM_FLOW_MS = 45;

/** Pixel geometry for rails, gates, wires, switches, and the Z output terminal. */
export const LAYOUT = {
  marginX: 60,
  marginY: 70,
  railSpacing: 64,
  layerSpacing: 110,
  gateWidth: 52,
  gateHeight: 44,
  /** Horizontal gap between the two left back arcs on XOR gates */
  xorBackGap: 3,
  notWidth: 28,
  notHeight: 28,
  rowStep: 56,
  wireStub: 18,
  /** Gap before gate input where wire turns vertical then enters horizontally */
  gateWireStub: 20,
  /** Horizontal gap between the rightmost rail and the first gate column */
  railToGateGap: 50,
  jumperRadius: 5,
  /** Filled dot where a horizontal wire meets a rail */
  railDotRadius: 4,
  labelOffsetY: -28,
  switchBelowLabel: 20,
  railTop: 50,
  outputLabelSize: 26,
  outputCircleR: 22,
};

export interface SourceSpan {
  start: number;
  end: number;
}

export type GateType = 'NOT' | 'AND' | 'OR' | 'XOR';

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
  /** Simulation: signal source when wire taps an input rail */
  fromVar?: string;
  /** Simulation: signal source when wire leaves a gate output */
  fromGateId?: string;
  toGateId?: string;
  /** 0 = upper pin, 1 = lower pin on dual-input gates */
  toInput?: 0 | 1;
  /** Final wire to the Z output terminal */
  isOutput?: boolean;
}

export interface VarTapLayout {
  name: string;
  x: number;
  y: number;
}

export interface SwitchLayout {
  name: string;
  x: number;
  y: number;
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
  /** Tap points where each input variable leaves its vertical rail */
  varTaps: VarTapLayout[];
  /** HTML switch overlay positions (below input labels) */
  switches: SwitchLayout[];
  output: Point;
  width: number;
  height: number;
}
