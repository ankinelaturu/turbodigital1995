import { useCallback, useEffect, useRef, useState } from 'react';
import type { CircuitLayout, SourceSpan } from '../lib/types';
import { COLORS } from '../lib/types';
import { buildDrawQueue, type Stroke } from '../lib/drawQueue';
import { drawCompletedStroke, drawCRTOverlay, drawStroke } from '../lib/canvasDraw';
import { gateHitBounds } from '../lib/gateGeometry';
import { CursorTooltip } from '@/components/ui/tooltip';

interface CircuitCanvasProps {
  layout: CircuitLayout | null;
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

export function CircuitCanvas({ layout, drawKey, onGateHover }: CircuitCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const strokesRef = useRef<StrokeState[]>([]);
  const currentIndexRef = useRef(0);
  const strokeStartRef = useRef(0);
  const [complete, setComplete] = useState(false);
  const [displayScale, setDisplayScale] = useState(1);
  const [gateHover, setGateHover] = useState<GateHover | null>(null);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, layout.width, layout.height);

    const states = strokesRef.current;
    for (let i = 0; i < states.length; i++) {
      const s = states[i];
      if (s.done) {
        drawCompletedStroke(ctx, s.stroke);
      } else if (i === currentIndexRef.current) {
        drawStroke(ctx, s.stroke, s.progress);
      }
    }

    drawCRTOverlay(ctx, layout.width, layout.height);
  }, [layout]);

  useEffect(() => {
    if (!layout) return;

    const queue = buildDrawQueue(layout);
    strokesRef.current = queue.map((stroke) => ({ stroke, progress: 0, done: false }));
    currentIndexRef.current = 0;
    strokeStartRef.current = performance.now();
    setComplete(false);
    setGateHover(null);
    onGateHover?.(null);

    const applySize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const cw = container.clientWidth - 24;
      const scale = Math.min(1, cw / layout.width);
      canvas.width = Math.floor(layout.width * scale);
      canvas.height = Math.floor(layout.height * scale);
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(scale, 0, 0, scale, 0, 0);
      setDisplayScale(scale);
      paint();
    };

    applySize();

    const ro = new ResizeObserver(applySize);
    if (containerRef.current) ro.observe(containerRef.current);

    const tick = (now: number) => {
      const idx = currentIndexRef.current;
      const states = strokesRef.current;
      if (idx >= states.length) {
        setComplete(true);
        paint();
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

      paint();
      animRef.current = requestAnimationFrame(tick);
    };

    paint();
    animRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, [layout, drawKey, paint]);

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

  const stageWidth = layout ? layout.width * displayScale : 0;
  const stageHeight = layout ? layout.height * displayScale : 0;

  return (
    <div className="circuit-canvas-wrap" ref={containerRef}>
      {layout && (
        <div
          className="circuit-canvas-stage"
          style={{ width: stageWidth, height: stageHeight }}
        >
          <canvas ref={canvasRef} className="circuit-canvas" />
          <div className="gate-hit-layer">
            {layout.gates.map((gate) => {
              const bounds = gateHitBounds(gate);
              return (
                <button
                  key={gate.id}
                  type="button"
                  className="gate-hit-target"
                  style={{
                    left: bounds.x * displayScale,
                    top: bounds.y * displayScale,
                    width: bounds.w * displayScale,
                    height: bounds.h * displayScale,
                  }}
                  aria-label={`${gate.type}: ${gate.expression}`}
                  onPointerEnter={(e) => showGateTooltip(gate, e.clientX, e.clientY)}
                  onPointerMove={(e) => moveGateTooltip(e.clientX, e.clientY)}
                  onPointerLeave={hideGateTooltip}
                />
              );
            })}
          </div>
        </div>
      )}
      {!layout && <canvas ref={canvasRef} className="circuit-canvas" />}
      {!layout && <p className="canvas-placeholder">Enter an expression and click Draw</p>}
      {layout && complete && <p className="canvas-status">Drawing complete</p>}

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
