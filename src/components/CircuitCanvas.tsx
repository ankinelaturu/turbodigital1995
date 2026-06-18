/**
 * Circuit canvas: pen-draw animation, then interactive simulation.
 *
 * Lifecycle:
 * 1. `drawKey` change → build stroke queue, animate pen draw
 * 2. Queue complete → `computeSimulation`, enable input switches
 * 3. Switch toggle → delta flow animation on changed segments only
 *
 * The draw effect intentionally depends only on `[layout, drawKey]` — callbacks
 * are held in refs so completing the animation does not restart the pen draw.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AST } from '../lib/parse';
import type { CircuitLayout, SourceSpan } from '../lib/types';
import { SIM_FLOW_MS } from '../lib/types';
import { buildDrawQueue, type Stroke } from '../lib/drawQueue';
import { drawCompletedStroke, drawStroke } from '../lib/canvasDraw';
import {
  computeViewport,
  layoutToScreen,
  paintWithViewport,
  type CanvasViewport,
} from '../lib/canvasViewport';
import { gateHitBounds } from '../lib/gateGeometry';
import {
  computeSimulation,
  defaultInputs,
  segmentDelta,
  type SimulationState,
} from '../lib/simulate';
import { paintSimulation, type FlowEntry } from '../lib/simulationDraw';
import { CursorTooltip } from '@/components/ui/tooltip';

/**
 * Props for the main circuit canvas component.
 */
interface CircuitCanvasProps {
  layout: CircuitLayout | null;
  ast: AST | null;
  drawKey: number;
  onGateHover?: (hover: GateHover | null) => void;
}

interface StrokeState {
  stroke: Stroke;
  progress: number;
  done: boolean;
}

interface GateHover {
  type: string;
  expression: string;
  x: number;
  y: number;
  sourceSpan: SourceSpan;
}

/**
 * Main circuit canvas: pen-draw animation, then interactive simulation with switches.
 */
export function CircuitCanvas({ layout, ast, drawKey, onGateHover }: CircuitCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const simAnimRef = useRef<number>(0);
  const strokesRef = useRef<StrokeState[]>([]);
  const currentIndexRef = useRef(0);
  const strokeStartRef = useRef(0);
  const flowAnimRef = useRef<Map<string, FlowEntry>>(new Map());
  const flowStartRef = useRef(0);
  const simRef = useRef<SimulationState | null>(null);
  const prevSegmentsRef = useRef<Set<string>>(new Set());
  const completeRef = useRef(false);
  const viewportRef = useRef<CanvasViewport | null>(null);

  const [complete, setComplete] = useState(false);
  const [viewport, setViewport] = useState<CanvasViewport | null>(null);
  const [gateHover, setGateHover] = useState<GateHover | null>(null);
  const [inputs, setInputs] = useState<Record<string, boolean>>({});
  const [simAnimating, setSimAnimating] = useState(false);
  const [simTick, setSimTick] = useState(0);

  const paintPen = useCallback(() => {
    const canvas = canvasRef.current;
    const vp = viewportRef.current;
    if (!canvas || !layout || !vp) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    paintWithViewport(ctx, vp, () => {
      const states = strokesRef.current;
      for (let i = 0; i < states.length; i++) {
        const s = states[i];
        if (s.done) {
          drawCompletedStroke(ctx, s.stroke, false, true);
        } else if (i === currentIndexRef.current) {
          drawStroke(ctx, s.stroke, s.progress, false, true);
        }
      }
    });
  }, [layout]);

  const paintSim = useCallback(() => {
    const canvas = canvasRef.current;
    const vp = viewportRef.current;
    if (!canvas || !layout || !simRef.current || !vp) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    paintSimulation(ctx, layout, simRef.current, flowAnimRef.current, vp);
  }, [layout]);

  const initSimulation = useCallback(() => {
    if (!layout || !ast) return;
    const nextInputs = defaultInputs(layout.variables);
    setInputs(nextInputs);
    const sim = computeSimulation(ast, layout, nextInputs);
    simRef.current = sim;
    prevSegmentsRef.current = new Set(sim.activeSegments);
    flowAnimRef.current = new Map();
    setSimAnimating(false);
    setSimTick((t) => t + 1);
  }, [layout, ast]);

  /**
   * Stable refs so the pen-draw effect does not re-run when simulation state updates.
   */
  const paintPenRef = useRef(paintPen);
  paintPenRef.current = paintPen;
  const paintSimRef = useRef(paintSim);
  paintSimRef.current = paintSim;
  const initSimulationRef = useRef(initSimulation);
  initSimulationRef.current = initSimulation;
  const onGateHoverRef = useRef(onGateHover);
  onGateHoverRef.current = onGateHover;

  const applySize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !layout) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (cw <= 0 || ch <= 0) {
      requestAnimationFrame(() => applySize());
      return;
    }
    const vp = computeViewport(cw, ch, layout.width, layout.height);
    canvas.width = Math.max(1, Math.floor(cw));
    canvas.height = Math.max(1, Math.floor(ch));
    viewportRef.current = vp;
    setViewport(vp);
    if (completeRef.current) paintSimRef.current();
    else if (strokesRef.current.length > 0) paintPenRef.current();
  }, [layout]);

  useLayoutEffect(() => {
    if (!layout) return;
    applySize();
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => applySize());
    ro.observe(container);
    return () => ro.disconnect();
  }, [layout, drawKey, applySize]);

  useEffect(() => {
    if (!layout) return;

    const queue = buildDrawQueue(layout);
    strokesRef.current = queue.map((stroke) => ({ stroke, progress: 0, done: false }));
    currentIndexRef.current = 0;
    strokeStartRef.current = performance.now();
    completeRef.current = false;
    setComplete(false);
    setGateHover(null);
    setSimAnimating(false);
    flowAnimRef.current = new Map();
    onGateHoverRef.current?.(null);

    const tick = (now: number) => {
      const idx = currentIndexRef.current;
      const states = strokesRef.current;
      if (idx >= states.length) {
        completeRef.current = true;
        setComplete(true);
        initSimulationRef.current();
        paintSimRef.current();
        return;
      }

      const current = states[idx];
      const elapsed = now - strokeStartRef.current;
      current.progress = Math.min(1, elapsed / current.stroke.durationMs);

      if (current.progress >= 1) {
        current.progress = 1;
        current.done = true;
        currentIndexRef.current = idx + 1;
        strokeStartRef.current = now;
      }

      paintPenRef.current();
      animRef.current = requestAnimationFrame(tick);
    };

    paintPenRef.current();
    animRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animRef.current);
      cancelAnimationFrame(simAnimRef.current);
    };
    /**
     * Only restart pen draw when layout or drawKey changes — not when simulation completes.
     */
  }, [layout, drawKey]);

  useEffect(() => {
    if (!complete) return;
    paintSim();
  }, [complete, simTick, paintSim]);

  const startFlowAnimation = useCallback(
    (added: Set<string>, removed: Set<string>, nextSim: SimulationState) => {
      const flow = new Map<string, FlowEntry>();
      for (const key of added) flow.set(key, { progress: 0, direction: 'on' });
      for (const key of removed) flow.set(key, { progress: 0, direction: 'off' });
      flowAnimRef.current = flow;
      flowStartRef.current = performance.now();
      simRef.current = nextSim;
      setSimAnimating(true);

      const tick = (now: number) => {
        const elapsed = now - flowStartRef.current;
        let allDone = true;
        for (const entry of flowAnimRef.current.values()) {
          entry.progress = Math.min(1, elapsed / SIM_FLOW_MS);
          if (entry.progress < 1) allDone = false;
        }

        paintSim();
        if (allDone) {
          flowAnimRef.current = new Map();
          prevSegmentsRef.current = new Set(nextSim.activeSegments);
          setSimAnimating(false);
          return;
        }

        simAnimRef.current = requestAnimationFrame(tick);
      };

      cancelAnimationFrame(simAnimRef.current);
      simAnimRef.current = requestAnimationFrame(tick);
    },
    [paintSim],
  );

  const toggleSwitch = useCallback(
    (name: string) => {
      if (!layout || !ast || simAnimating || !complete) return;
      const nextInputs = { ...inputs, [name]: !inputs[name] };
      const nextSim = computeSimulation(ast, layout, nextInputs);
      const { added, removed } = segmentDelta(prevSegmentsRef.current, nextSim.activeSegments);

      setInputs(nextInputs);

      if (added.size === 0 && removed.size === 0) {
        simRef.current = nextSim;
        setSimTick((t) => t + 1);
        return;
      }

      startFlowAnimation(added, removed, nextSim);
    },
    [layout, ast, simAnimating, complete, inputs, startFlowAnimation],
  );

  const showGateTooltip = useCallback(
    (gate: CircuitLayout['gates'][number], x: number, y: number) => {
      const hover: GateHover = {
        type: gate.type,
        expression: gate.expression,
        x,
        y,
        sourceSpan: gate.sourceSpan,
      };
      setGateHover(hover);
      onGateHover?.(hover);
    },
    [onGateHover],
  );

  const moveGateTooltip = useCallback((x: number, y: number) => {
    setGateHover((prev) => (prev ? { ...prev, x, y } : null));
  }, []);

  const hideGateTooltip = useCallback(() => {
    setGateHover(null);
    onGateHover?.(null);
  }, [onGateHover]);

  const lastSwitch = layout?.switches[layout.switches.length - 1];
  const switchHintPos =
    viewport && lastSwitch ? layoutToScreen(viewport, lastSwitch.x, lastSwitch.y) : null;

  return (
    <div className="circuit-canvas-wrap" ref={containerRef}>
      {layout && (
        <div className="circuit-canvas-stage">
          <canvas ref={canvasRef} className="circuit-canvas" />
          {viewport && (
            <>
          <div className="gate-hit-layer">
            {complete &&
              layout.gates.map((gate) => {
                const bounds = gateHitBounds(gate);
                const topLeft = layoutToScreen(viewport, bounds.x, bounds.y);
                return (
                  <button
                    key={gate.id}
                    type="button"
                    className="gate-hit-target"
                    style={{
                      left: topLeft.x,
                      top: topLeft.y,
                      width: bounds.w * viewport.scale,
                      height: bounds.h * viewport.scale,
                    }}
                    aria-label={`${gate.type}: ${gate.expression}`}
                    onPointerEnter={(e) => showGateTooltip(gate, e.clientX, e.clientY)}
                    onPointerMove={(e) => moveGateTooltip(e.clientX, e.clientY)}
                    onPointerLeave={hideGateTooltip}
                  />
                );
              })}
          </div>
          {complete && (
            <div className="switch-layer">
              {layout.switches.map((sw) => {
                const on = inputs[sw.name] ?? false;
                const pos = layoutToScreen(viewport, sw.x, sw.y);
                return (
                  <button
                    key={sw.name}
                    type="button"
                    className={`input-switch ${on ? 'on' : 'off'}`}
                    style={{
                      left: pos.x,
                      top: pos.y,
                    }}
                    disabled={simAnimating}
                    aria-label={`Input ${sw.name}: ${on ? 'on' : 'off'}`}
                    aria-pressed={on}
                    onClick={() => toggleSwitch(sw.name)}
                  >
                    <span className="input-switch-track" />
                    <span className="input-switch-thumb" />
                    <span className="input-switch-label">{sw.name}</span>
                  </button>
                );
              })}
              {lastSwitch && switchHintPos && (
                <p
                  className="canvas-status-inline"
                  style={{ left: switchHintPos.x + 26, top: switchHintPos.y }}
                >
                  {simAnimating ? 'Current flowing…' : 'Toggle inputs to simulate'}
                </p>
              )}
            </div>
          )}
            </>
          )}
        </div>
      )}
      {!layout && <canvas ref={canvasRef} className="circuit-canvas" />}
      {!layout && <p className="canvas-placeholder">Enter an expression and click Draw</p>}

      <CursorTooltip open={gateHover !== null} x={gateHover?.x ?? 0} y={gateHover?.y ?? 0}>
        {gateHover && (
          <>
            <span className="text-[#5dff4a]">{gateHover.type}</span>
            <span className="text-[#6a9a6a]"> · </span>
            {gateHover.expression}
          </>
        )}
      </CursorTooltip>
    </div>
  );
}
