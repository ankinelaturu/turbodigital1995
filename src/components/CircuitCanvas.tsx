import { useCallback, useEffect, useRef, useState } from 'react';
import type { CircuitLayout } from '../lib/types';
import { COLORS } from '../lib/types';
import { buildDrawQueue, type Stroke } from '../lib/drawQueue';
import { drawCompletedStroke, drawCRTOverlay, drawStroke } from '../lib/canvasDraw';

interface CircuitCanvasProps {
  layout: CircuitLayout | null;
  drawKey: number;
}

interface StrokeState {
  stroke: Stroke;
  progress: number;
  done: boolean;
}

export function CircuitCanvas({ layout, drawKey }: CircuitCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const strokesRef = useRef<StrokeState[]>([]);
  const currentIndexRef = useRef(0);
  const strokeStartRef = useRef(0);
  const [complete, setComplete] = useState(false);

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

  return (
    <div className="circuit-canvas-wrap" ref={containerRef}>
      <canvas ref={canvasRef} className="circuit-canvas" />
      {!layout && <p className="canvas-placeholder">Enter an expression and click Draw</p>}
      {layout && complete && <p className="canvas-status">Drawing complete</p>}
    </div>
  );
}
